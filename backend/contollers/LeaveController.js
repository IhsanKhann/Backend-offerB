import mongoose from "mongoose";
import FinalizedEmployeeModel from "../models/HRModals/FinalizedEmployees.model.js";
import RoleModel from "../models/HRModals/Role.model.js";

/**
 * Apply for leave
 */
export const applyLeave = async (req, res) => {
  try {
    const { employeeId, leaveType, leaveReason, leaveStartDate, leaveEndDate } = req.body;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    if (employee.leave?.onLeave) {
      return res.status(400).json({
        message: `Employee is already on ${employee.leave.leaveType} leave until ${employee.leave.leaveEndDate}`,
      });
    }

    employee.leave = {
      onLeave: true,
      leaveType,
      leaveReason,
      leaveStartDate,
      leaveEndDate,
      leaveAccepted: false,
      leaveRejected: false,
      transferredRoleTo: null,
    };

    await employee.save();
    return res.status(200).json({ message: "Leave applied successfully", leave: employee.leave });
  } catch (err) {
    console.error("Leave apply error:", err);
    return res.status(500).json({ message: "Failed to apply leave", error: err.message });
  }
};

/**
 * Get all employees currently on leave
 */
export const getOnLeaveEmployees = async (req, res) => {
  try {
    const employees = await FinalizedEmployeeModel.find({ "leave.onLeave": true })
      .populate({ path: "role", populate: { path: "permissions" }, strictPopulate: false })
      .populate("orgUnit")
      .select("-password -passwordHash -refreshToken");

    return res.json({ success: true, data: employees });
  } catch (err) {
    console.error("Error fetching on-leave employees:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Accept leave
 */
export const acceptLeave = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    if (!employee.leave?.onLeave) return res.status(400).json({ message: "Employee is not on leave" });

    employee.leave.leaveAccepted = true;
    employee.leave.leaveRejected = false;
    employee.leave.RejectionLeaveReason = undefined;
    employee.leave.RejectedBy = undefined;

    await employee.save();
    return res.json({ message: "Leave accepted", leave: employee.leave });
  } catch (err) {
    console.error("Error accepting leave:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Reject leave
 */
export const rejectLeave = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ message: "Rejection reason is required" });

    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    employee.leave.onLeave = false;
    employee.leave.leaveAccepted = false;
    employee.leave.leaveRejected = true;
    employee.leave.RejectionLeaveReason = reason;
    employee.leave.RejectedBy = req.user?.name || req.user?.email || "System";

    await employee.save();
    return res.json({ message: "Leave rejected", leave: employee.leave });
  } catch (err) {
    console.error("Error rejecting leave:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Transfer permissions/role during leave
 */
export const transferDuringLeave = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { employeeId } = req.params;
    const { targetEmployeeId } = req.body;
    if (!targetEmployeeId) {
      await session.abortTransaction();
      return res.status(400).json({ message: "targetEmployeeId is required" });
    }

    const [source, target] = await Promise.all([
      FinalizedEmployeeModel.findById(employeeId).populate("role").session(session),
      FinalizedEmployeeModel.findById(targetEmployeeId).populate("role").session(session),
    ]);

    if (!source?.leave?.onLeave) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Source employee is not on leave" });
    }
    if (!target) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Target employee not found" });
    }

    // Backup source role & permissions
    source.previous_role = source.role?._id || null;
    source.rolePermissionsBackup = source.role?.permissions || [];
    source.role = null;

    // Create temporary role for target
    const tempRole = await RoleModel.create(
      [{ roleName: `Temp role for ${source.individualName}`, orgUnit: target.orgUnit, permissions: source.rolePermissionsBackup }],
      { session }
    );

    // Backup target role
    target.previous_role = target.role || null;
    target.role = tempRole[0]._id;

    source.leave.transferredRoleTo = target._id;

    await Promise.all([source.save({ session }), target.save({ session })]);
    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Permissions transferred during leave",
      data: {
        source: { _id: source._id, previous_role: source.previous_role, rolePermissionsBackup: source.rolePermissionsBackup },
        target: { _id: target._id, role: target.role },
      },
    });
  } catch (err) {
    console.error("Error transferring leave permissions:", err);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Take leave back & restore roles & permissions
 */
export const takeLeaveBack = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId).populate("role");
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    if (!employee.leave || (!employee.leave.leaveAccepted && !employee.leave.onLeave)) {
      return res.status(400).json({ message: "No active leave to take back" });
    }

    // Restore delegated employee role & permissions
    if (employee.leave.transferredRoleTo) {
      const target = await FinalizedEmployeeModel.findById(employee.leave.transferredRoleTo).populate("role");
      if (target) {
        if (target.previous_role) target.role = target.previous_role;
        if (target.rolePermissionsBackup?.length) {
          const role = await RoleModel.findById(target.role);
          if (role) { role.permissions = target.rolePermissionsBackup; await role.save(); }
        }
        target.previous_role = null;
        target.rolePermissionsBackup = [];
        await target.save();
      }
    }

    // Restore original employee role & permissions
    if (employee.previous_role) employee.role = employee.previous_role;
    if (employee.rolePermissionsBackup?.length) {
      const role = await RoleModel.findById(employee.role);
      if (role) { role.permissions = employee.rolePermissionsBackup; await role.save(); }
    }

    employee.leave = { onLeave: false };
    employee.previous_role = null;
    employee.rolePermissionsBackup = [];
    await employee.save();

    return res.json({ message: "Leave taken back successfully. Roles and permissions restored." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Delete leave application
 */
export const deleteLeave = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    employee.leave = { onLeave: false };
    await employee.save();
    return res.json({ message: "Leave application deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Get single employee leave
 */
export const getSingleEmployeeLeave = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    return res.json({ leave: employee.leave || { onLeave: false } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};




import mongoose from "mongoose";
import FinalizedEmployeeModel from "../models/HRModals/FinalizedEmployees.model.js";
import RoleModel from "../models/HRModals/Role.model.js";

/**
 * Apply Leave
 */
export const applyLeave = async (req, res) => {
  try {
    const { employeeId, leaveType, leaveReason, leaveStartDate, leaveEndDate } = req.body;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // If already on leave, block
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
    console.error(err);
    return res.status(500).json({ message: "Failed to apply leave", error: err.message });
  }
};

/**
 * Accept Leave
 */
export const acceptLeave = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { transferredRoleTo } = req.body;

    const employee = await FinalizedEmployeeModel.findById(employeeId)
      .populate("role")
      .populate("role.permissions");

    if (!employee) return res.status(404).json({ message: "Employee not found" });

    if (employee.leave?.leaveAccepted) {
      return res.status(400).json({ message: "Leave already accepted" });
    }

    const target = await FinalizedEmployeeModel.findById(transferredRoleTo)
      .populate("role")
      .populate("role.permissions");

    if (!target) return res.status(404).json({ message: "Target employee not found" });

    // STEP 1: Backup current employee’s role & permissions
    employee.previous_role = employee.role;
    employee.rolePermissionsBackup = employee.role?.permissions || [];

    // STEP 2: Remove permissions from employee going on leave
    if (employee.role) {
      await RoleModel.findByIdAndUpdate(employee.role._id, {
        permissions: employee.defaultPermissions || [],
      });
    }

    // STEP 3: Transfer permissions to target
    target.previous_role = target.role;
    target.rolePermissionsBackup = target.role?.permissions || [];

    const combinedPermissions = [
      ...(target.defaultPermissions || []),
      ...(employee.rolePermissionsBackup || []),
    ];

    if (target.role) {
      await RoleModel.findByIdAndUpdate(target.role._id, {
        permissions: [...new Set(combinedPermissions)],
      });
    }

    // STEP 4: Update leave info
    employee.leave.leaveAccepted = true;
    employee.leave.leaveRejected = false;
    employee.leave.onLeave = true;
    employee.leave.transferredRoleTo = target._id;

    await employee.save();
    await target.save();

    return res.json({
      message: "Leave accepted and permissions transferred",
      employeeId: employee._id,
      targetId: target._id,
    });
  } catch (err) {
    console.error("🔥 acceptLeave error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};


/**
 * Reject Leave
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
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Transfer Permissions during Leave
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

    // Assign default permissions so source can’t be locked out
    if (source.role) {
      const role = await RoleModel.findById(source.role._id);
      if (role && source.defaultPermissions?.length) {
        role.permissions = source.defaultPermissions;
        await role.save();
      }
    }

    // Remove role temporarily
    source.role = null;

    // Create temporary role for target
    const tempRole = await RoleModel.create(
      [
        {
          roleName: `Temp role for ${source.individualName}`,
          orgUnit: target.orgUnit,
          permissions: source.rolePermissionsBackup,
        },
      ],
      { session }
    );

    target.previous_role = target.role?._id || null;
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
    console.error(err);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Take Leave Back
 */
export const takeLeaveBack = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId)
      .populate("role")
      .populate("role.permissions");
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    if (!employee.leave || (!employee.leave.leaveAccepted && !employee.leave.onLeave)) {
      return res.status(400).json({ message: "No active leave to take back" });
    }

    // Restore delegated employee
    if (employee.leave.transferredRoleTo) {
      const target = await FinalizedEmployeeModel.findById(employee.leave.transferredRoleTo)
        .populate("role")
        .populate("role.permissions");

      if (target && target.role) {
        if (target.previous_role) target.role = target.previous_role;

        const restoredPermissions = [...new Set([...(target.rolePermissionsBackup || []), ...(target.defaultPermissions || [])])];

        await RoleModel.findByIdAndUpdate(target.role._id, { permissions: restoredPermissions });

        target.previous_role = null;
        target.rolePermissionsBackup = [];
        await target.save();
      }
    }

    // Restore original employee
    if (employee.previous_role) employee.role = employee.previous_role;
    const restoredPermissions = [...new Set([...(employee.rolePermissionsBackup || []), ...(employee.defaultPermissions || [])])];

    if (employee.role) {
      await RoleModel.findByIdAndUpdate(employee.role._id, { permissions: restoredPermissions });
    }

    employee.leave = { onLeave: false };
    employee.previous_role = null;
    employee.rolePermissionsBackup = restoredPermissions;
    await employee.save();

    return res.json({ message: "Leave taken back successfully. Roles and permissions restored." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Get Single Employee Leave
 */
export const getSingleEmployeeLeave = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Default "Pending" if leave not applied yet
    const leave = employee.leave || { onLeave: false, leaveAccepted: false, leaveRejected: false };
    return res.json({ leave });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Get All Employees on Leave
 */
export const getOnLeaveEmployees = async (req, res) => {
  try {
    const employees = await FinalizedEmployeeModel.find({ "leave.onLeave": true })
      .populate({ path: "role", populate: { path: "permissions" } })
      .populate("orgUnit")
      .select("-password -passwordHash -refreshToken");

    return res.json({ success: true, data: employees });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Delete Leave
 */
export const deleteLeave = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Only allow deletion if leave exists
    if (!employee.leave || (!employee.leave.onLeave && !employee.leave.leaveAccepted && !employee.leave.leaveRejected)) {
      return res.status(400).json({ message: "No leave record found to delete" });
    }

    // Reset leave completely
    employee.leave = undefined;
    await employee.save();

    return res.json({ message: "Leave record deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

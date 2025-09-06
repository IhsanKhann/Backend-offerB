import mongoose from "mongoose";
import FinalizedEmployeeModel from "../models/HRModals/FinalizedEmployees.model.js";
import RoleModel from "../models/HRModals/Role.model.js";
import { PermissionModel } from "../models/HRModals/Permissions.model.js";

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
    const { leaveId } = req.params;
    const { transferredRoleTo } = req.body || {};

    if (!transferredRoleTo) {
      return res.status(400).json({
        message: "Please provide a target employee to transfer role/permissions.",
      });
    }

    const employee = await FinalizedEmployeeModel.findById(leaveId)
      .populate("role")
      .populate("role.permissions");

    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Ensure leave exists and is pending
    if (!employee.leave || !employee.leave.onLeave) {
      return res.status(400).json({ message: "No leave request found to accept" });
    }

    if (employee.leave.leaveAccepted) {
      return res.status(400).json({ message: "Leave already accepted" });
    }

    // Target employee
    const target = await FinalizedEmployeeModel.findById(transferredRoleTo)
      .populate("role")
      .populate("role.permissions");

    if (!target) return res.status(404).json({ message: "Target employee not found" });

    // --- Backup employee’s state ---
    employee.previous_role = employee.role;
    employee.rolePermissionsBackup = employee.role?.permissions?.map((p) => p._id) || [];

    if (employee.role) {
      await RoleModel.findByIdAndUpdate(employee.role._id, { permissions: [] });
    }

    // --- Backup target ---
    target.previous_role = target.role;
    target.rolePermissionsBackup = target.role?.permissions?.map((p) => p._id) || [];

    const combinedPermissions = [...(employee.rolePermissionsBackup || [])];

    if (target.role) {
      await RoleModel.findByIdAndUpdate(target.role._id, {
        permissions: [...new Set(combinedPermissions)],
      });
    }

    // --- Mark leave accepted ---
    employee.leave = {
      ...(employee.leave || {}),
      onLeave: true,
      leaveAccepted: true,
      leaveRejected: false,
      transferredRoleTo: target._id,
    };

    await Promise.all([employee.save(), target.save()]);

    return res.json({
      message: "✅ Leave accepted & permissions transferred successfully",
      employeeId: employee._id,
      targetId: target._id,
    });
  } catch (err) {
    console.error("🔥 acceptLeave error:", err);
    return res.status(500).json({
      message: "Server error during leave acceptance",
      error: err.message,
    });
  }
};

/**
 * Reject Leave
 */
export const rejectLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ message: "Rejection reason is required" });

    const employee = await FinalizedEmployeeModel.findById(leaveId);
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
 * Take Leave Back (restore roles & permissions)
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

        const restoredPermissions = [...new Set(target.rolePermissionsBackup || [])];

        await RoleModel.findByIdAndUpdate(target.role._id, {
          permissions: restoredPermissions,
        });

        target.previous_role = null;
        target.rolePermissionsBackup = [];
        await target.save();
      }
    }

    // Restore original employee
    if (employee.previous_role) employee.role = employee.previous_role;

    const restoredPermissions = [...new Set(employee.rolePermissionsBackup || [])];

    if (employee.role) {
      await RoleModel.findByIdAndUpdate(employee.role._id, { permissions: restoredPermissions });
    }

    employee.leave = { onLeave: false };
    employee.previous_role = null;
    employee.rolePermissionsBackup = [];
    await employee.save();

    return res.json({ message: "Leave taken back successfully. Roles and permissions restored." });
  } catch (err) {
    console.error("🔥 takeLeaveBack error:", err);
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

    if (!employee.leave || (!employee.leave.onLeave && !employee.leave.leaveAccepted && !employee.leave.leaveRejected)) {
      return res.status(400).json({ message: "No leave record found to delete" });
    }

    employee.leave = undefined;
    await employee.save();

    return res.json({ message: "Leave record deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

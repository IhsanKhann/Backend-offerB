import mongoose from "mongoose";
import RoleModel from "../models/HRModals/Role.model.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import {OrgUnitModel} from "../models/HRModals/OrgUnit.js";

// ============================================
// ROLE DECLARATION MANAGEMENT (GLOBAL)
// ============================================

/**
 * ✅ Add Role Declaration (Global - no department/status)
 */
export const addRole = async (req, res) => {
  try {
    const { 
      roleName, 
      description, 
      category, 
      salaryRules, 
      permissions = [] 
    } = req.body;

    if (!roleName) {
      return res.status(400).json({ success: false, message: "Role name required" });
    }

    if (!salaryRules || typeof salaryRules.baseSalary !== "number") {
      return res.status(400).json({
        success: false,
        message: "Salary rules with baseSalary are required",
      });
    }

    const exists = await RoleModel.findOne({
      roleName: new RegExp(`^${roleName}$`, "i"),
    });

    if (exists) {
      return res.status(400).json({ success: false, message: "Role already exists" });
    }

    const role = await RoleModel.create({
      roleName,
      description: description || "",
      category: category || "Staff",
      salaryRules: {
        baseSalary: salaryRules.baseSalary,
        salaryType: salaryRules.salaryType || "monthly",
        allowances: salaryRules.allowances || [],
        deductions: salaryRules.deductions || [],
        terminalBenefits: salaryRules.terminalBenefits || [],
      },
      permissions,
      isActive: true,
    });

    res.status(201).json({ success: true, data: role });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ✅ Delete Role Declaration
 */
export const deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    const activeAssignments = await RoleAssignmentModel.countDocuments({ 
      roleId, 
      isActive: true 
    });

    if (activeAssignments > 0) {
      return res.status(400).json({ 
        message: `Cannot delete role. ${activeAssignments} active assignment(s) exist.`, 
        success: false 
      });
    }

    const role = await RoleModel.findByIdAndDelete(roleId);

    if (!role) {
      return res.status(404).json({ 
        message: "Role not found", 
        success: false 
      });
    }

    res.status(200).json({ 
      message: "Role declaration deleted successfully", 
      success: true 
    });
  } catch (err) {
    console.error("❌ deleteRole error:", err);
    res.status(500).json({ 
      message: "Server error", 
      success: false, 
      error: err.message 
    });
  }
};

/**
 * ✅ Update Role Declaration
 */
export const updateRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const updates = req.body;

    const role = await RoleModel.findById(roleId);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    Object.assign(role, updates);
    await role.save();

    res.status(200).json({ success: true, data: role });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ✅ Get All Role Declarations
 */
export const getAllRolesList = async (req, res) => {
  try {
    const roles = await RoleModel.find({ isActive: true })
      .populate("permissions", "name description")
      .sort({ roleName: 1 });

    res.status(200).json({ 
      message: "Roles found", 
      success: true, 
      Roles: roles 
    });
  } catch (err) {
    console.error("❌ getAllRolesList error:", err);
    res.status(500).json({ 
      message: "Server error", 
      success: false, 
      error: err.message 
    });
  }
};

/**
 * ✅ Get Single Role Declaration
 */
export const getRoleById = async (req, res) => {
  try {
    const { roleId } = req.params;

    const role = await RoleModel.findById(roleId)
      .populate("permissions", "name description");

    if (!role) {
      return res.status(404).json({ 
        message: "Role not found", 
        success: false 
      });
    }

    res.status(200).json({ 
      message: "Role found", 
      success: true, 
      role 
    });
  } catch (err) {
    console.error("❌ getRoleById error:", err);
    res.status(500).json({ 
      message: "Server error", 
      success: false, 
      error: err.message 
    });
  }
};

// ============================================
// ROLE ASSIGNMENT QUERIES
// ============================================

/**
 * ✅ Get Employee Role Assignment
 */
export const getEmployeeRoleAssignment = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const assignment = await RoleAssignmentModel.findOne({ 
      employeeId, 
      isActive: true 
    })
      .populate("roleId", "roleName description category salaryRules permissions")
      .populate("orgUnit", "name parent status code")
      .populate("assignedBy", "individualName personalEmail");

    if (!assignment) {
      return res.status(404).json({ 
        message: "No active role assignment found", 
        success: false 
      });
    }

    res.status(200).json({ 
      message: "Role assignment found", 
      success: true, 
      data: assignment 
    });
  } catch (err) {
    console.error("❌ getEmployeeRoleAssignment error:", err);
    res.status(500).json({ 
      message: "Server error", 
      success: false, 
      error: err.message 
    });
  }
};

/**
 * ✅ NEW: Get Roles by Department (with assignment metadata)
 * Returns ALL global roles, but marks which are used in the department
 */
export const getRolesByDepartment = async (req, res) => {
  try {
    const { code } = req.params;

    if (!["HR", "Finance", "BusinessOperation"].includes(code)) {
      return res.status(400).json({ 
        message: "Invalid department code", 
        success: false 
      });
    }

    // Get all active roles
    const allRoles = await RoleModel.find({ isActive: true })
      .populate("permissions", "name description")
      .sort({ roleName: 1 })
      .lean();

    // Get role assignments in this department
    const assignments = await RoleAssignmentModel.find({ 
      departmentCode: code,
      isActive: true 
    })
      .populate("roleId")
      .lean();

    // Create a map of role usage
    const roleUsageMap = new Map();
    assignments.forEach(a => {
      const roleIdStr = a.roleId?._id?.toString();
      if (roleIdStr) {
        roleUsageMap.set(roleIdStr, (roleUsageMap.get(roleIdStr) || 0) + 1);
      }
    });

    // Add metadata to roles
    const rolesWithMetadata = allRoles.map(role => ({
      ...role,
      isUsedInDepartment: roleUsageMap.has(role._id.toString()),
      assignmentCount: roleUsageMap.get(role._id.toString()) || 0
    }));

    res.status(200).json({ 
      message: "Roles found", 
      success: true, 
      count: rolesWithMetadata.length,
      department: code,
      roles: rolesWithMetadata
    });
  } catch (err) {
    console.error("❌ getRolesByDepartment error:", err);
    res.status(500).json({ 
      message: "Server error", 
      success: false, 
      error: err.message 
    });
  }
};

/**
 * ✅ NEW: Get Role Assignments Grouped by Role
 * For the "Grouped" view in the UI
 */
export const getRoleAssignmentsGroupedByRole = async (req, res) => {
  try {
    const data = await RoleAssignmentModel.aggregate([
      // Only active assignments
      { $match: { isActive: true } },

      // Join Role declaration
      {
        $lookup: {
          from: "roles",
          localField: "roleId",
          foreignField: "_id",
          as: "role",
        },
      },
      { $unwind: "$role" },

      // Group assignments by role
      {
        $group: {
          _id: "$role._id",

          role: { $first: "$role" },

          assignments: {
            $push: {
              assignmentId: "$_id",
              employeeId: "$employeeId",
              departmentId: "$departmentId",
              departmentCode: "$departmentCode",
              status: "$status",
              orgUnit: "$orgUnit",
              effectiveFrom: "$effectiveFrom",
              effectiveUntil: "$effectiveUntil",
            },
          },

          totalAssignments: { $sum: 1 },
        },
      },

      // Clean response
      {
        $project: {
          _id: 0,
          roleId: "$_id",
          role: 1,
          assignments: 1,
          totalAssignments: 1,
        },
      },

      { $sort: { "role.roleName": 1 } },
    ]);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Role grouping error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to group role assignments",
    });
  }
};

/**
 * ✅ NEW: Get Employees by Role
 * Shows which employees have this role, grouped by department
 */
export const getEmployeesByRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({ message: "Invalid roleId" });
    }

    const data = await RoleAssignmentModel.aggregate([
      {
        $match: {
          roleId: new mongoose.Types.ObjectId(roleId),
          isActive: true,
        },
      },

      // Join employee
      {
        $lookup: {
          from: "finalizedemployees",
          localField: "employeeId",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },

      // Group employees by department
      {
        $group: {
          _id: {
            departmentCode: "$departmentCode",
          },

          employees: {
            $push: {
              employeeId: "$employee._id",
              name: "$employee.individualName",
              email: "$employee.personalEmail",
              assignmentId: "$_id",
              status: "$status",
            },
          },

          totalEmployees: { $sum: 1 },
        },
      },

      {
        $project: {
          _id: 0,
          departmentCode: "$_id.departmentCode",
          employees: 1,
          totalEmployees: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      roleId,
      departments: data,
    });
  } catch (error) {
    console.error("Employees by role error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees for role",
    });
  }
};

/**
 * ✅ NEW: Get All Active Assignments by Department
 */
export const getAssignmentsByDepartment = async (req, res) => {
  try {
    const { code } = req.params;

    if (!["HR", "Finance", "BusinessOperation"].includes(code)) {
      return res.status(400).json({ 
        message: "Invalid department code", 
        success: false 
      });
    }

    const assignments = await RoleAssignmentModel.find({ 
      departmentCode: code,
      isActive: true 
    })
      .populate("roleId", "roleName category")
      .populate("employeeId", "individualName personalEmail UserId")
      .populate("orgUnit", "name status")
      .sort({ "roleId.roleName": 1 })
      .lean();

    res.status(200).json({ 
      message: "Assignments found", 
      success: true, 
      count: assignments.length,
      department: code,
      assignments
    });
  } catch (err) {
    console.error("❌ getAssignmentsByDepartment error:", err);
    res.status(500).json({ 
      message: "Server error", 
      success: false, 
      error: err.message 
    });
  }
};

// ============================================
// LEGACY COMPATIBILITY
// ============================================

export const getAllRoles = getAllRolesList;
export const getSingleRole = getRoleById;
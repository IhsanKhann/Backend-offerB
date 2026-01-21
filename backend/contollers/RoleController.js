import RoleModel from "../models/HRModals/Role.model.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import {OrgUnitModel} from "../models/HRModals/OrgUnit.js";

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
      description,
      category,
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

// ---------------------- Delete Role Declaration ----------------------
export const deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    // Check if any active assignments exist
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

// ---------------------- Update Role Declaration ----------------------
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

// ---------------------- Get All Role Declarations ----------------------
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

// ---------------------- Get Employee Role Assignment ----------------------
export const getEmployeeRoleAssignment = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const assignment = await RoleAssignmentModel.findOne({ 
      employeeId, 
      isActive: true 
    })
      .populate("roleId", "roleName description code status salaryRules permissions")
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

// ---------------------- Get Roles by Department ----------------------
export const getRolesByDepartment = async (req, res) => {
  try {
    const { code } = req.params;

    if (!["HR", "Finance", "BusinessOperation"].includes(code)) {
      return res.status(400).json({ 
        message: "Invalid department code", 
        success: false 
      });
    }

    const roles = await RoleModel.find({ code, isActive: true })
      .populate("permissions", "name description")
      .sort({ roleName: 1 });

    res.status(200).json({ 
      message: "Roles found", 
      success: true, 
      count: roles.length,
      roles 
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
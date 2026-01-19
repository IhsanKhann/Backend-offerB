import RoleModel from "../models/HRModals/Role.model.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import {OrgUnitModel} from "../models/HRModals/OrgUnit.js";

export const addRole = async (req, res) => {
  try {
    const {
      roleName,
      description,
      code,
      status,
      salaryRules,
      permissions = []
    } = req.body;

    // Validate required fields
    if (!roleName) {
      return res.status(400).json({ 
        message: "Role name is required", 
        success: false 
      });
    }

    if (!code) {
      return res.status(400).json({ 
        message: "Department code (HR/Finance/BusinessOperation) is required", 
        success: false 
      });
    }

    if (!status) {
      return res.status(400).json({ 
        message: "Status (hierarchy level) is required", 
        success: false 
      });
    }

    if (!salaryRules || typeof salaryRules.baseSalary !== "number") {
      return res.status(400).json({ 
        message: "Salary rules with base salary are required", 
        success: false 
      });
    }

    // Check if role already exists
    const existingRole = await RoleModel.findOne({ 
      roleName: { $regex: new RegExp(`^${roleName}$`, "i") }
    });

    if (existingRole) {
      return res.status(400).json({ 
        message: "Role with this name already exists", 
        success: false 
      });
    }

    // Create new role declaration
    const newRole = new RoleModel({
      roleName,
      description: description || "",
      code,
      status,
      salaryRules: {
        baseSalary: salaryRules.baseSalary,
        salaryType: salaryRules.salaryType || "monthly",
        allowances: Array.isArray(salaryRules.allowances) ? salaryRules.allowances : [],
        deductions: Array.isArray(salaryRules.deductions) ? salaryRules.deductions : [],
        terminalBenefits: Array.isArray(salaryRules.terminalBenefits) ? salaryRules.terminalBenefits : [],
      },
      permissions: permissions || [],
      isActive: true,
    });

    await newRole.save();

    res.status(201).json({ 
      message: "Role declaration created successfully", 
      success: true, 
      data: newRole 
    });
  } catch (err) {
    console.error("❌ addRole error:", err);
    res.status(500).json({ 
      message: "Server error", 
      success: false, 
      error: err.message 
    });
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
    const {
      roleName,
      description,
      code,
      status,
      salaryRules,
      permissions,
      isActive
    } = req.body;

    const role = await RoleModel.findById(roleId);
    
    if (!role) {
      return res.status(404).json({ 
        message: "Role not found", 
        success: false 
      });
    }

    // Update fields
    if (roleName) role.roleName = roleName;
    if (description !== undefined) role.description = description;
    if (code) role.code = code;
    if (status) role.status = status;
    if (salaryRules) role.salaryRules = salaryRules;
    if (permissions) role.permissions = permissions;
    if (isActive !== undefined) role.isActive = isActive;

    await role.save();

    res.status(200).json({ 
      message: "Role declaration updated successfully", 
      success: true, 
      data: role 
    });
  } catch (err) {
    console.error("❌ updateRole error:", err);
    res.status(500).json({ 
      message: "Server error", 
      success: false, 
      error: err.message 
    });
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
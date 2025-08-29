import EmployeeModel from "../models/Employee.model.js";
import RoleModel from "../models/Role.model.js";
import { OrgUnitModel } from "../models/OrgUnit.js";
import { PermissionModel } from "../models/Permissions.model.js";

// helper function to keep the special employees permissions updated..
function KeepPermissionsUpdated(){
  // 1- which roles => (chariman,board of directors..)
};

export const getEmployeePermissions = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "employeeId is required" });
    }

    // 1️⃣ Find employee and populate role + permissions inside role
    const employee = await FinalizedEmployee.findById(employeeId)
      .populate({
        path: "role",
        populate: {
          path: "permissions",
          model: "Permission",
        },
      });

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // 2️⃣ Extract permissions
    const permissions = employee.role?.permissions || [];

    return res.status(200).json({
      success: true,
      employeeId,
      permissions, // full permission objects
    });

  } catch (error) {
    console.error("🔥 getEmployeePermissions error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch permissions" });
  }
};

export const AllPermissions = async (req, res) => {
  try {
    const permissions = await PermissionModel.find(); // ✅ await the query

    return res.status(200).json({
      status: true,
      message: "Permissions fetched successfully",
      Permissions: permissions, // ✅ return actual array
    });
  } catch (error) {
    console.error("AllPermissions error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

// ---------------- Create Permission ----------------
export const createPermission = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({
        status: false,
        message: "Name and description are required",
      });
    }

    const existingPermission = await PermissionModel.findOne({
      $or: [{ name }, { description }],
    });

    if (existingPermission) {
      return res.status(400).json({
        status: false,
        message: "The permission already exists",
      });
    }

    const newPermission = await PermissionModel.create({ name, description });

    return res.status(201).json({
      status: true,
      message: "Permission created successfully",
      permission: newPermission,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

// ---------------- Delete Permission (with ID reset) ----------------
export const removePermission = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPermission = await PermissionModel.findByIdAndDelete(id);

    if (!deletedPermission) {
      return res.status(404).json({
        status: false,
        message: "Permission does not exist",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Permission deleted successfully",
      permission: deletedPermission,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};


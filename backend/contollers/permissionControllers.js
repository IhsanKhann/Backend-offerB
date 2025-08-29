import EmployeeModel from "../models/Employee.model.js";
import RoleModel from "../models/Role.model.js";
import { OrgUnitModel } from "../models/OrgUnit.js";
import { PermissionModel } from "../models/Permissions.model.js";

export const getEmployeePermissions = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "employeeId is required" });
    }

    // 1️⃣ Find employee
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // 2️⃣ Set to store unique permissions
    const permissionsSet = new Set();

    // --- Helper: Collect permissions from a role
    const collectRolePermissions = async (roleId) => {
      if (!roleId) return;
      const role = await RoleModel.findById(roleId).populate("permissions");
      if (role?.permissions) {
        role.permissions.forEach((perm) => permissionsSet.add(perm.name));
      }
    };

    // 3️⃣ Collect direct role permissions
    await collectRolePermissions(employee.role);

    // 4️⃣ Traverse orgUnit hierarchy and collect permissions from roles assigned to orgUnits
    let currentOrgUnit = await OrgUnitModel.findById(employee.orgUnit).populate("role");
    while (currentOrgUnit) {
      if (currentOrgUnit.role) {
        await collectRolePermissions(currentOrgUnit.role);
      }
      if (!currentOrgUnit.parent) break;
      currentOrgUnit = await OrgUnitModel.findById(currentOrgUnit.parent).populate("role");
    }

    // 5️⃣ Return permissions as an array
    return res.status(200).json({
      success: true,
      employeeId,
      permissions: Array.from(permissionsSet),
    });

  } catch (error) {
    console.error("🔥 getEmployeePermissions error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch permissions" });
  }
};

export const AllPermissions = async (req, res) => {
  try {
    const permissions = await PermissionModel.find();

    return res.status(200).json({
      status: true,
      message: "Permissions fetched successfully",
      permissions, // use lowercase 'permissions' to match variable
    });
  } catch (error) {
    console.error(error);
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

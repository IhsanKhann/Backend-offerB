import EmployeeModel from "../models/Employee.model.js";
import RoleModel from "../models/Role.model.js";
import { PermissionModel } from "../models/Permissions.model.js";
import FinalizedEmployee from "../models/FinalizedEmployees.model.js";

// helper function to keep the special employees permissions updated..
export async function KeepPermissionsUpdated() {
  try {
    const alwaysUpdateRoles = ["Chairman", "BoD Member"];

    // 1️⃣ Fetch all permissions
    const allPermissions = await PermissionModel.find({});
    if (!allPermissions.length) {
      console.warn("No permissions found in DB.");
      return;
    }
    const allPermissionIds = allPermissions.map((p) => p._id.toString());

    // 2️⃣ Fetch roles that need to always have all permissions
    const roles = await RoleModel.find({ roleName: { $in: alwaysUpdateRoles } });

    if (!roles.length) {
      console.warn("No matching roles found for KeepPermissionsUpdated.");
      return;
    }

    // 3️⃣ Update each role only if needed
    for (const role of roles) {
      const currentIds = role.permissions.map((id) => id.toString());

      // Compare arrays (skip save if already up-to-date)
      const isDifferent =
        currentIds.length !== allPermissionIds.length ||
        !currentIds.every((id) => allPermissionIds.includes(id));

      if (isDifferent) {
        role.permissions = allPermissionIds;
        await role.save();
        console.log(`Updated role '${role.roleName}' with latest permissions.`);
      } else {
        console.log(`Role '${role.roleName}' is already up-to-date.`);
      }
    }

    console.log("KeepPermissionsUpdated finished successfully!");
  } catch (error) {
    console.error("KeepPermissionsUpdated error:", error.stack || error.message);
  }
};

// ✅ Get an employee's permissions (from their role)
export const getEmployeePermissions = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // 🔒 Validate employeeId
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "employeeId is required",
      });
    }

    // 1️⃣ Find employee, populate role and permissions
    const employee = await FinalizedEmployee.findById(employeeId)
      .populate({
        path: "role",
        populate: {
          path: "permissions",
          model: "Permission",
          select: "_id name description", // ✅ only useful fields
        },
      });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // 2️⃣ Extract permissions safely
    const permissions = employee.role?.permissions ?? [];

    return res.status(200).json({
      success: true,
      employeeId: employee._id,
      employeeName: employee.fullName || employee.name, // optional extra info
      role: employee.role?.name || "No Role",
      permissions, // ✅ returns array of permission objects
    });

  } catch (error) {
    console.error("🔥 getEmployeePermissions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch permissions",
      error: error.message,
    });
  }
};

// ADD PERMISSION
export const addEmployeePermission = async (req, res) => {
  try {
    const { employeeId, permissionName } = req.body;

    if (!employeeId || !permissionName) {
      return res.status(400).json({
        success: false,
        message: "employeeId and permissionName are required",
      });
    }

    // 1. Get the permission by name
    const permission = await PermissionModel.findOne({ name: permissionName });
    if (!permission) {
      return res.status(404).json({ success: false, message: "Permission not found" });
    }

    // 2. Find employee and populate role
    const employee = await FinalizedEmployee.findById(employeeId).populate("role");
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const role = await RoleModel.findById(employee.role._id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // 3. Check if already exists
    const alreadyExists = role.permissions.some(
      (perm) => perm.toString() === permission._id.toString()
    );
    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        message: "Permission already assigned to this role",
      });
    }

    // 4. Add and save
    role.permissions.push(permission._id);
    await role.save();

    return res.status(200).json({
      success: true,
      message: "Permission added successfully",
      permissions: role.permissions,
    });
  } catch (error) {
    console.error("🔥 addEmployeePermission error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to add permission" });
  }
};

// REMOVE PERMISSION
export const removeEmployeePermission = async (req, res) => {
  try {
    const { employeeId, permissionName } = req.body;

    if (!employeeId || !permissionName) {
      return res.status(400).json({
        success: false,
        message: "employeeId and permissionName are required",
      });
    }

    // 1. Resolve permission by name
    const permission = await PermissionModel.findOne({ name: permissionName });
    if (!permission) {
      return res.status(404).json({ success: false, message: "Permission not found" });
    }

    // 2. Find employee and role
    const employee = await FinalizedEmployee.findById(employeeId).populate("role");
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const role = await RoleModel.findById(employee.role._id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // 3. Check if permission exists
    const hasPermission = role.permissions.some(
      (perm) => perm.toString() === permission._id.toString()
    );
    if (!hasPermission) {
      return res.status(400).json({
        success: false,
        message: "Permission not assigned to this role",
      });
    }

    // 4. Remove and save
    role.permissions = role.permissions.filter(
      (perm) => perm.toString() !== permission._id.toString()
    );
    await role.save();

    return res.status(200).json({
      success: true,
      message: "Permission removed successfully",
      permissions: role.permissions,
    });
  } catch (error) {
    console.error("🔥 removeEmployeePermission error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to remove permission" });
  }
};

// for any component that need permission to be added..(admin dashboard,permission handler etc in frontend)
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

// for permission handler
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

// for permission handler
export const removePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;

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

export const updatePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const { name, description } = req.body;

    if (!name?.trim() || !description?.trim()) {
      return res.status(400).json({ message: "Name and description are required." });
    }

    // Find and update
    const updatedPermission = await Permission.findByIdAndUpdate(
      id,
      { name, description },
      { new: true, runValidators: true }
    );

    if (!updatedPermission) {
      return res.status(404).json({ message: "Permission not found." });
    }

    await KeepPermissionsUpdated();

    res.status(200).json({
      message: "Permission updated successfully",
      permission: updatedPermission,
    });
  } catch (error) {
    console.error("Error updating permission:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

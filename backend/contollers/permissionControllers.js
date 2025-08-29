import EmployeeModel from "../models/Employee.model.js";
import RoleModel from "../models/Role.model.js";
import { OrgUnitModel } from "../models/OrgUnit.js";

const PermissionsArray = [
  { id: 1, name: "view_all_employees", description: "Permission to view all employees" },
  { id: 2, name: "view_single_employee", description: "Permission to view a single employee" },
  { id: 3, name: "register_employee", description: "Permission to register new employees" },
  { id: 4, name: "approve_employee", description: "Permission to approve employee actions" },
  { id: 5, name: "reject_employee", description: "Permission to reject employee actions" },
  { id: 6, name: "delete_employee", description: "Permission to delete an employee" },
  { id: 7, name: "assign_employee_role", description: "Permission to assign roles to employees" },
  { id: 8, name: "view_all_roles", description: "Permission to view all roles" },
  { id: 9, name: "resolve_org_unit", description: "Permission to resolve organizational unit" },
  { id: 10, name: "create_org_unit", description: "Permission to create organizational units" },
  { id: 11, name: "view_org_units", description: "Permission to view organizational units" },
  { id: 12, name: "view_employees_by_org_unit", description: "Permission to view employees by org unit" },
  { id: 13, name: "view_all_finalized_employees", description: "Permission to view all finalized employees" },
  { id: 14, name: "add_Permissions", description: "Permission to add new permissions" },
  { id: 15, name: "delete_Permissions", description: "Permission to delete permissions" },
  { id: 16, name: "view_Permissions", description: "Permission to view permissions" },
  { id: 17, name: "add_HierarchyLevel", description: "Permission to add a hierarchy level" },
  { id: 18, name: "delete_HierarchyLevel", description: "Permission to delete a hierarchy level" },
];


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

export const AllPermissions = async(req,res) => {
  try{
    return res.status(200).json({
      status:true,
      message: "Permissions fetched successfully",
      Permissions: PermissionsArray,
    })
  }
  catch(error){
     return res.status(500).json({
      status:false,
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

    // Check for duplicate name
    const exists = PermissionsArray.find(p => p.name === name);
    if (exists) {
      return res.status(400).json({
        status: false,
        message: "Permission with this name already exists",
      });
    }

    const newPermission = {
      id: Math.max(...PermissionsArray.map(p => p.id), 0) + 1,
      name,
      description,
    };

    PermissionsArray.push(newPermission);

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

    const permIndex = PermissionsArray.findIndex(p => p.id === parseInt(id));
    if (permIndex === -1) {
      return res.status(404).json({
        status: false,
        message: "Permission not found",
      });
    }

    // Remove the permission
    const removed = PermissionsArray.splice(permIndex, 1);

    // Reassign IDs sequentially starting from 1
    PermissionsArray.forEach((perm, index) => {
      perm.id = index + 1;
    });

    return res.status(200).json({
      status: true,
      message: "Permission deleted successfully",
      permission: removed[0],
      updatedPermissions: PermissionsArray, // optional: return updated array
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};
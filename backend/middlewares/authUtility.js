import FinalizedEmployeesModel from "../models/FinalizedEmployees.model.js";
import { OrgUnitModel } from "../models/OrgUnit.js";
import RoleModel from "../models/Role.model.js";
import { PermissionModel } from "../models/Permissions.model.js";
import EmployeeModel from "../models/Employee.model.js";
import { HierarchyModel } from "../models/Hiearchy.model.js";

/**
 * Middleware to automatically detect and attach resourceOrgUnit
 * based on the current route/resource being accessed.
 */
export const setResourceOrgUnit = async (req, res, next) => {
  try {
    let orgUnitId = null;

    // Safe helper
    const id = (key) => req.params?.[key] || req.body?.[key];

    if (req.baseUrl.includes("/employees")) {
      const employee = await EmployeeModel.findById(id("employeeId") || id("id"));
      if (employee) orgUnitId = employee.orgUnit;
    } else if (req.baseUrl.includes("/finalizedEmployees")) {
      const finalized = await FinalizedEmployee.findById(id("finalizedEmployeeId") || id("id"));
      if (finalized) orgUnitId = finalized.orgUnit;
    } else if (req.baseUrl.includes("/permissions")) {
      const permission = await PermissionModel.findById(id("permissionId") || id("id"));
      if (permission) orgUnitId = permission.orgUnit;
    } else if (req.baseUrl.includes("/roles")) {
      const role = await RoleModel.findById(id("roleId") || id("id"));
      if (role) orgUnitId = role.orgUnit;
    } else if (req.baseUrl.includes("/org-units") || req.baseUrl.includes("/hierarchy")) {
      orgUnitId = id("orgUnitId") || id("id");
    }

    req.resourceOrgUnit = orgUnitId || null;
    next();
  } catch (err) {
    console.error("setResourceOrgUnit error:", err);
    return res.status(500).json({ message: "Error resolving resource orgUnit" });
  }
};


/**
 * Recursively fetch all employees under an orgUnit and its children.
 */
export const getAllDescendents = async (orgUnitId) => {
  let employees = await FinalizedEmployeesModel.find({ orgUnit: orgUnitId }).populate("role");

  const children = await OrgUnitModel.find({ parent: orgUnitId });

  for (const child of children) {
    const childEmployees = await getAllDescendents(child._id);
    employees = employees.concat(childEmployees);
  }

  return employees;
};

/**
 * Get all permissions for a user including their descendents.
 */
export const getPermissionsForUser = async (user) => {
  const permissions = new Set();

  // User's own role permissions
  const userRole = await RoleModel.findById(user.role).populate("permissions");
  if (userRole) {
    userRole.permissions.forEach(p => permissions.add(p.name));
  }

  // Descendent employees' permissions
  const descendents = await getAllDescendents(user.orgUnit);
  const roles = await Promise.all(descendents.map(d => RoleModel.findById(d.role).populate("permissions")));

  roles.forEach(r => {
    if (r) r.permissions.forEach(p => permissions.add(p.name));
  });

  return permissions;
};

/**
 * Get the root org unit for a given orgUnitId
 */
export async function getRootOrgUnit(orgUnitId) {
  let current = await OrgUnitModel.findById(orgUnitId);
  while (current && current.parent) {
    current = await OrgUnitModel.findById(current.parent);
  }
  return current;
}

import EmployeeModel from "../models/HRModals/Employee.model.js";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import {PermissionModel} from "../models/HRModals/Permissions.model.js";
import RoleModel from "../models/HRModals/Role.model.js";
import {OrgUnitModel} from "../models/HRModals/OrgUnit.js";
import { HierarchyModel } from "../models/HRModals/Hiearchy.model.js";

const modelMap = {
  employees: { model: EmployeeModel, keys: ["employeeId", "id"] },
  finalizedEmployees: { model: FinalizedEmployee, keys: ["finalizedEmployeeId", "id"] },
  permissions: { model: PermissionModel, keys: ["permissionId", "id"] },
  roles: { model: RoleModel, keys: ["roleId", "id"] },
  "org-units": { model: OrgUnitModel, keys: ["orgUnitId", "id"] },
  hierarchy: { model: HierarchyModel, keys: ["hierarchyId", "id"] },
};

// Middleware
export const setResourceOrgUnit = async (req, res, next) => {
  try {
    let orgUnitId = null;

    // 🔹 Extract resource name from baseUrl (first segment after /api if present)
    const resource = req.baseUrl.split("/").filter(Boolean).pop(); 
    // e.g. "/api/employees" → "employees"

    // Safe helper to fetch IDs
    const getId = (keys) =>
      keys?.map((key) => req.params?.[key] || req.body?.[key]).find(Boolean);

    if (modelMap[resource]) {
      // DB-backed resources
      const { model, keys } = modelMap[resource];
      const id = getId(keys);
      if (id) {
        const doc = await model.findById(id);
        if (doc) orgUnitId = doc.orgUnit;
      }
    } else if (["org-units", "hierarchy"].includes(resource)) {
      // Direct resources → orgUnitId comes directly
      orgUnitId = getId(["orgUnitId", "id"]);
    }

    if (!orgUnitId) {
      return res
        .status(400)
        .json({ message: `Unable to resolve orgUnit for ${resource}` });
    }

    req.resourceOrgUnit = orgUnitId.toString();
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
  let employees = await FinalizedEmployee.find({ orgUnit: orgUnitId }).populate("role");

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

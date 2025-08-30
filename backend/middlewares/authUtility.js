import FinalizedEmployeesModel from "../models/FinalizedEmployees.model";
import { OrgUnitModel } from "../models/OrgUnit.model";
import RoleModel from "../models/Role.model";
import { PermissionModel } from "../models/Permissions.model";
import EmployeeModel from "../models/Employee.model";
import { HierarchyModel } from "../models/Hiearchy.model";

/**
 * Middleware to automatically detect and attach resourceOrgUnit
 * based on the current route/resource being accessed.
 * 
 */

export const setResourceOrgUnit = async (req, res, next) => {
  try {
    let orgUnitId = null;

    // ✅ Check which route/resource is being used
    if (req.baseUrl.includes("/employees")) {
      // Employee route → find employee's orgUnit
      const employee = await EmployeeModel.findById(req.params.id || req.body.employeeId);
      if (employee) orgUnitId = employee.orgUnit;
    }
    else if (req.baseUrl.includes("/finalizedEmployees")) {
      // Permission route → link to employee/orgUnit
      const permission = await FinalizedEmployeesModel.findById(req.params.id);
      if (permission) orgUnitId = permission.orgUnit;
    }  
    else if (req.baseUrl.includes("/permissions")) {
      // Permission route → link to employee/orgUnit
      const permission = await PermissionModel.findById(req.params.id);
      if (permission) orgUnitId = permission.orgUnit;
    } 
    else if (req.baseUrl.includes("/roles")) {
      // Role route → usually tied to orgUnit
      const role = await RoleModel.findById(req.params.id);
      if (role) orgUnitId = role.orgUnit;
    } 
    else if (req.baseUrl.includes("/orgUnits") || req.baseUrl.includes("/hierarchy")) {
      // OrgUnit/Hierarchy routes
      orgUnitId = req.params.id || req.body.orgUnitId;
    }

    // Attach detected orgUnitId to request
    req.resourceOrgUnit = orgUnitId;

    next();
  } catch (error) {
    console.error("setResourceOrgUnit error:", error);
    return res.status(500).json({ message: "Error resolving resource orgUnit" });
  }
};

export const getAllDescendents = async(orgUnitId) => {
    const children = await OrgUnitModel.find({
        parent: orgUnitId
    });

    const employees = await FinalizedEmployeesModel.find({
        orgUnit: orgUnitId
    }).populate("role");

    for(const child of children){
        const childEmployees = await getAllDescendents(child._id);

        employees = employees.concat(childEmployees);
    }

    return employees;
};

// descendents -> employees.
// getDescendentsEmployees -> employees -> return employees.

// start -> const employees = await getDescendentsEmployees(orgUnitId);

// 2- getAllThePermissions..
export const getPermissionsForUser = async(user) => {
    const permissions = new Set(); 
    // ensure uniqueness, is an object with unique keys, thus unique values.

    const userRole = await RoleModel.findById(user.role).populate("permissions");

    if(userRole){
        userRole.permissions.forEach(permission => {
            permissions.add(permission.name);
        });
    }

    const descendents = await getAllDescendents(user.orgUnit);

    for(const descendent of descendents){
        const descendentRole = await RoleModel.findById(descendent.role).populate("permissions");

        if(descendentRole){
            descendentRole.permissions.forEach(permission => {
                permissions.add(permission.name);
            });
        }
    }

    return permissions;
};

// main authorize -> give us full user from req.user;
// we take the user. We find all its descendents.. after finding descentents.. we find their roles.. after finding their roles.. we find their permissions.. after finding their permissions.. we return the permissions added with the user own permissions that is.

// so permissions user + descendents permissions.

export async function getRootOrgUnit(orgUnitId) {
  let current = await OrgUnitModel.findById(orgUnitId);
  while (current.parent) {
    current = await OrgUnitModel.findById(current.parent);
  }
  return current;
}


import EmployeeModel from "../models/Employee.model.js";
import RoleModel from "../models/Role.model.js";
import { OrgUnitModel } from "../models/OrgUnit.js";


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

import { OrgUnitModel } from "../models/OrgUnit.js";
import EmployeeModel from "../models/Employee.model.js";
import FinalizedEmployeesModel from "../models/FinalizedEmployees.model.js";
import RoleModel from "../models/Role.model.js";

/**
 * Helper: Build tree recursively
 */
const buildTree = (units, parentId = null) => {
  return units
    .filter(
      (u) => String(u.parent) === String(parentId) || (!u.parent && !parentId)
    )
    .map((u) => ({
      _id: u._id,
      name: u.name,
      parent: u.parent,
      children: buildTree(units, u._id),
    }));
};

export const getOrgUnits = async (req, res) => {
  try {
    const units = await OrgUnitModel.find().lean();
    const tree = buildTree(units);
    res.json(tree);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch hierarchy" });
  }
};

export const createOrgUnit = async (req, res) => {
  try {
    const { name, parent } = req.body;
    const unit = new OrgUnitModel({ name, parent: parent || null });
    await unit.save();
    res.status(201).json(unit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create org unit" });
  }
};

// ✅ Fetch employees of a specific hierarchy node (last node reached)
// controller
// Get employees for an OrgUnit (last level only)
export const getEmployeesByOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;

    if (!orgUnitId) {
      return res.status(400).json({ success: false, message: "orgUnitId is required" });
    }

    // ✅ Check if this OrgUnit is a leaf (no children)
    const hasChildren = await OrgUnitModel.exists({ parentId: orgUnitId });
    if (hasChildren) {
      return res.status(200).json({ success: true, employees: [] }); 
    }

    // ✅ Find roles linked to this orgUnit
    const roles = await RoleModel.find({ orgUnit: orgUnitId }).populate("employeeId");

    // ✅ Extract employees
    const employees = roles.map(role => ({
      roleName: role.roleName,
      employee: role.employeeId, // populated FinalizedEmployee
      permissions: role.permissions
    }));

    res.status(200).json({ success: true, employees });
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
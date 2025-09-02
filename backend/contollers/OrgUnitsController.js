import { OrgUnitModel } from "../models/OrgUnit.js";
import EmployeeModel from "../models/HRModals/Employee.model.js";
import FinalizedEmployeesModel from "../models/HRModals/FinalizedEmployees.model.js";
import RoleModel from "../models/HRModals/Role.model.js";

/**
 * Helper: Build tree recursively -> call itself inside it.
 */
const buildTree = (units, parentId = null) => {
  // filter gives me a unit
  return units
    .filter(
      (unit) => String(unit.parent) === String(parentId) || (!unit.parent && !parentId)
    )
    .map((unit) => ({
      _id: unit._id,
      name: unit.name,
      parent: unit.parent,
      children: buildTree(units, unit._id),
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

const getDescendantUnitIds = async (parentId) => {
  const children = await OrgUnitModel.find({ parent: parentId }).lean();
  let ids = children.map((c) => c._id);

  for (let child of children) {
    const childDescendants = await getDescendantUnitIds(child._id);
    ids = ids.concat(childDescendants);
  }
  return ids;
};

export const getEmployeesByOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;

    // collect all relevant unitIds
    let orgUnitIds = [orgUnitId];
    const descendants = await getDescendantUnitIds(orgUnitId);
    orgUnitIds = orgUnitIds.concat(descendants);

    // now fetch employees whose orgUnit is in any of those IDs
    const employees = await FinalizedEmployeesModel.find({
      orgUnit: { $in: orgUnitIds }
    }).populate("role orgUnit");

    res.json({ success: true, employees });
  } catch (err) {
    console.error("🔥 Error fetching employees by org unit:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch employees" });
  }
};
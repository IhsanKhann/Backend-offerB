import { OrgUnitModel } from "../models/OrgUnit.js";
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


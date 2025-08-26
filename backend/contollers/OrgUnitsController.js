import { OrgUnitModel } from "../models/OrgUnit.js";
import EmployeeModel from "../models/Employee.model.js";

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
export const getEmployeesByNode = async (req, res) => {
  try {
    const { orgUnitId } = req.params;

    if (!orgUnitId) {
      return res.status(400).json({
        success: false,
        message: "❌ orgUnitId is required to fetch employees",
      });
    }

    // 🔎 Find employees belonging to that node only
    const employees = await EmployeeModel.find({ OrganizationId: orgUnitId })
      .populate("role", "name permissions") // optional: role info
      .populate("OrganizationId", "name parent");   // optional: orgUnit infoit info

    return res.status(200).json({
      success: true,
      count: employees.length,
      employees,
    });
  } catch (error) {
    console.error("❌ Error fetching employees by node:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching employees",
      error: error.message,
    });
  }
};

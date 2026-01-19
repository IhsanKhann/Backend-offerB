import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";
import FinalizedEmployeesModel from "../models/HRModals/FinalizedEmployees.model.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import RoleModel from "../models/HRModals/Role.model.js";

/**
 * Helper: Calculate level in hierarchy
 */
const calculateLevel = async (parentId) => {
  if (!parentId) return 0;
  
  const parent = await OrgUnitModel.findById(parentId);
  if (!parent) return 0;
  
  return parent.level + 1;
};

/**
 * Helper: Derive status from level
 */
const deriveStatusFromLevel = (level) => {
  const statusMapping = {
    0: "Offices",
    1: "Groups",
    2: "Divisions",
    3: "Departments",
    4: "Branches",
    5: "Cells",
  };
  
  return statusMapping[level] || "Cells";
};

/**
 * Helper: Build tree recursively
 */
const buildTree = (units, parentId = null) => {
  return units
    .filter(
      (unit) => String(unit.parent) === String(parentId) || (!unit.parent && !parentId)
    )
    .map((unit) => ({
      _id: unit._id,
      name: unit.name,
      parent: unit.parent,
      status: unit.status,
      code: unit.code,
      level: unit.level,
      children: buildTree(units, unit._id),
    }));
};

// ---------------------- Get All Org Units (Tree) ----------------------
export const getOrgUnits = async (req, res) => {
  try {
    const units = await OrgUnitModel.find().lean();
    const tree = buildTree(units);
    res.json(tree);
  } catch (err) {
    console.error("❌ getOrgUnits error:", err);
    res.status(500).json({ error: "Failed to fetch hierarchy" });
  }
};

// ---------------------- Create Org Unit ----------------------
export const createOrgUnit = async (req, res) => {
  try {
    const { name, parent, code } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ 
        error: "Organization unit name is required" 
      });
    }

    if (!code) {
      return res.status(400).json({ 
        error: "Department code (HR/Finance/BusinessOperation) is required" 
      });
    }

    // Calculate level
    const level = await calculateLevel(parent);
    
    // Auto-derive status from level
    const status = deriveStatusFromLevel(level);

    const unit = new OrgUnitModel({ 
      name, 
      parent: parent || null,
      code,
      status,
      level,
    });

    await unit.save();

    res.status(201).json({
      message: "Organization unit created successfully",
      success: true,
      data: unit,
    });
  } catch (err) {
    console.error("❌ createOrgUnit error:", err);
    res.status(500).json({ error: "Failed to create org unit" });
  }
};

// ---------------------- Update Org Unit ----------------------
export const updateOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;
    const { name, parent, code } = req.body;

    const unit = await OrgUnitModel.findById(orgUnitId);
    
    if (!unit) {
      return res.status(404).json({ 
        error: "Organization unit not found" 
      });
    }

    // Update fields
    if (name) unit.name = name;
    if (code) unit.code = code;
    
    // If parent changes, recalculate level and status
    if (parent !== undefined) {
      unit.parent = parent;
      unit.level = await calculateLevel(parent);
      unit.status = deriveStatusFromLevel(unit.level);
    }

    await unit.save();

    res.status(200).json({
      message: "Organization unit updated successfully",
      success: true,
      data: unit,
    });
  } catch (err) {
    console.error("❌ updateOrgUnit error:", err);
    res.status(500).json({ error: "Failed to update org unit" });
  }
};

// ---------------------- Delete Org Unit ----------------------
export const deleteOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;

    // Check if unit has children
    const children = await OrgUnitModel.countDocuments({ parent: orgUnitId });
    
    if (children > 0) {
      return res.status(400).json({ 
        error: "Cannot delete org unit with children. Delete children first." 
      });
    }

    // Check if any active role assignments exist
    const activeAssignments = await RoleAssignmentModel.countDocuments({ 
      orgUnit: orgUnitId, 
      isActive: true 
    });

    if (activeAssignments > 0) {
      return res.status(400).json({ 
        error: `Cannot delete org unit. ${activeAssignments} active role assignment(s) exist.` 
      });
    }

    await OrgUnitModel.findByIdAndDelete(orgUnitId);

    res.status(200).json({
      message: "Organization unit deleted successfully",
      success: true,
    });
  } catch (err) {
    console.error("❌ deleteOrgUnit error:", err);
    res.status(500).json({ error: "Failed to delete org unit" });
  }
};

// ---------------------- Get Descendant Unit IDs ----------------------
const getDescendantUnitIds = async (parentId) => {
  const children = await OrgUnitModel.find({ parent: parentId }).lean();
  let ids = children.map((c) => c._id);

  for (let child of children) {
    const childDescendants = await getDescendantUnitIds(child._id);
    ids = ids.concat(childDescendants);
  }
  return ids;
};

// ---------------------- Get Employees by Org Unit ----------------------
export const getEmployeesByOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;

    // Collect all relevant unitIds (including descendants)
    let orgUnitIds = [orgUnitId];
    const descendants = await getDescendantUnitIds(orgUnitId);
    orgUnitIds = orgUnitIds.concat(descendants);

    // Find active role assignments in these org units
    const assignments = await RoleAssignmentModel.find({
      orgUnit: { $in: orgUnitIds },
      isActive: true,
    })
      .populate("employeeId", "individualName personalEmail UserId")
      .populate("roleId", "roleName code status")
      .populate("orgUnit", "name code status");

    const employees = assignments.map(a => ({
      _id: a.employeeId._id,
      individualName: a.employeeId.individualName,
      personalEmail: a.employeeId.personalEmail,
      UserId: a.employeeId.UserId,
      role: a.roleId,
      orgUnit: a.orgUnit,
      assignmentId: a._id,
      code: a.code,
      status: a.status,
    }));

    res.json({ 
      success: true, 
      count: employees.length,
      employees 
    });
  } catch (err) {
    console.error("🔥 Error fetching employees by org unit:", err.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch employees" 
    });
  }
};

// ---------------------- Get Employees by Department & Status ----------------------
export const getEmployeesByDepartmentAndStatus = async (req, res) => {
  try {
    const { code, status } = req.query;

    // Build filter
    const filter = { isActive: true };
    if (code) filter.code = code;
    if (status) filter.status = status;

    const assignments = await RoleAssignmentModel.find(filter)
      .populate("employeeId", "individualName personalEmail UserId")
      .populate("roleId", "roleName code status")
      .populate("orgUnit", "name code status");

    const employees = assignments.map(a => ({
      _id: a.employeeId._id,
      individualName: a.employeeId.individualName,
      personalEmail: a.employeeId.personalEmail,
      UserId: a.employeeId.UserId,
      role: a.roleId,
      orgUnit: a.orgUnit,
      assignmentId: a._id,
      code: a.code,
      status: a.status,
    }));

    res.json({ 
      success: true, 
      count: employees.length,
      employees 
    });
  } catch (err) {
    console.error("🔥 Error fetching employees by department:", err.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch employees" 
    });
  }
};

// ---------------------- Get Org Units by Department ----------------------
export const getOrgUnitsByDepartment = async (req, res) => {
  try {
    const { code } = req.params;

    if (!["HR", "Finance", "BusinessOperation"].includes(code)) {
      return res.status(400).json({ 
        error: "Invalid department code" 
      });
    }

    const units = await OrgUnitModel.find({ code })
      .populate("roleAssignment")
      .sort({ level: 1, name: 1 });

    res.json({ 
      success: true, 
      count: units.length,
      orgUnits: units 
    });
  } catch (err) {
    console.error("🔥 Error fetching org units by department:", err.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch org units" 
    });
  }
};
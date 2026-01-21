// FIXED OrgUnitsController.js
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
    6: "Desks",
  };
  
  return statusMapping[level] || "Desks";
};

/**
 * ✅ FIXED: Build tree recursively with proper child handling
 */
const buildTree = (units, parentId = null) => {
  return units
    .filter((unit) => {
      // Root level nodes
      if (!parentId && !unit.parent) return true;
      // Child nodes - compare as strings to handle ObjectId
      if (parentId && unit.parent) {
        return String(unit.parent) === String(parentId);
      }
      return false;
    })
    .map((unit) => ({
      _id: unit._id,
      name: unit.name,
      parent: unit.parent,
      status: unit.status,
      code: unit.code,
      level: unit.level,
      roleAssignment: unit.roleAssignment,
      children: buildTree(units, unit._id), // Recursively build children
    }));
};

// ✅ FIXED: Get All Org Units (Tree) - Now properly returns nested structure
export const getOrgUnits = async (req, res) => {
  try {
    // Fetch all org units and convert to plain objects
    const units = await OrgUnitModel.find()
      .populate('roleAssignment')
      .lean();
    
    console.log(`📦 Fetched ${units.length} org units from database`);
    
    // Build hierarchical tree structure
    const tree = buildTree(units);
    
    console.log(`🌳 Built tree with ${tree.length} root nodes`);
    
    res.status(200).json({
      success: true,
      count: units.length,
      rootCount: tree.length,
      data: tree
    });
  } catch (err) {
    console.error("❌ getOrgUnits error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch hierarchy",
      message: err.message 
    });
  }
};

// ✅ Get Single OrgUnit by ID
export const getSingleOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;
    
    const orgUnit = await OrgUnitModel.findById(orgUnitId)
      .populate('roleAssignment')
      .populate('parent');
    
    if (!orgUnit) {
      return res.status(404).json({
        success: false,
        message: "OrgUnit not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: orgUnit
    });
  } catch (err) {
    console.error("❌ getSingleOrgUnit error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch org unit",
      message: err.message
    });
  }
};

// ---------------------- Create Org Unit ----------------------
export const createOrgUnit = async (req, res) => {
  try {
    const { name, parent, code } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ 
        success: false,
        error: "Organization unit name is required" 
      });
    }

    if (!code) {
      return res.status(400).json({ 
        success: false,
        error: "Department code (HR/Finance/BusinessOperation) is required" 
      });
    }

    // Validate code
    if (!["HR", "Finance", "BusinessOperation"].includes(code)) {
      return res.status(400).json({
        success: false,
        error: "Invalid department code. Must be HR, Finance, or BusinessOperation"
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

    console.log(`✅ Created OrgUnit: ${name} (Level: ${level}, Status: ${status})`);

    res.status(201).json({
      message: "Organization unit created successfully",
      success: true,
      data: unit,
    });
  } catch (err) {
    console.error("❌ createOrgUnit error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to create org unit",
      message: err.message 
    });
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
        success: false,
        error: "Organization unit not found" 
      });
    }

    // Update fields
    if (name) unit.name = name;
    if (code) {
      if (!["HR", "Finance", "BusinessOperation"].includes(code)) {
        return res.status(400).json({
          success: false,
          error: "Invalid department code"
        });
      }
      unit.code = code;
    }
    
    // If parent changes, recalculate level and status
    if (parent !== undefined) {
      unit.parent = parent || null;
      unit.level = await calculateLevel(parent);
      unit.status = deriveStatusFromLevel(unit.level);
    }

    await unit.save();

    console.log(`✅ Updated OrgUnit: ${unit.name}`);

    res.status(200).json({
      message: "Organization unit updated successfully",
      success: true,
      data: unit,
    });
  } catch (err) {
    console.error("❌ updateOrgUnit error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to update org unit",
      message: err.message 
    });
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
        success: false,
        error: `Cannot delete org unit with ${children} children. Delete children first.` 
      });
    }

    // Check if any active role assignments exist
    const activeAssignments = await RoleAssignmentModel.countDocuments({ 
      orgUnit: orgUnitId, 
      isActive: true 
    });

    if (activeAssignments > 0) {
      return res.status(400).json({ 
        success: false,
        error: `Cannot delete org unit. ${activeAssignments} active role assignment(s) exist.` 
      });
    }

    await OrgUnitModel.findByIdAndDelete(orgUnitId);

    console.log(`✅ Deleted OrgUnit: ${orgUnitId}`);

    res.status(200).json({
      message: "Organization unit deleted successfully",
      success: true,
    });
  } catch (err) {
    console.error("❌ deleteOrgUnit error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to delete org unit",
      message: err.message 
    });
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

// ✅ FIXED: Get Employees by Org Unit
export const getEmployeesByOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;

    console.log(`📋 Fetching employees for OrgUnit: ${orgUnitId}`);

    // Collect all relevant unitIds (including descendants)
    let orgUnitIds = [orgUnitId];
    const descendants = await getDescendantUnitIds(orgUnitId);
    orgUnitIds = orgUnitIds.concat(descendants);

    console.log(`📦 Searching in ${orgUnitIds.length} org units (including descendants)`);

    // Find active role assignments in these org units
    const assignments = await RoleAssignmentModel.find({
      orgUnit: { $in: orgUnitIds },
      isActive: true,
    })
      .populate("employeeId", "individualName personalEmail UserId avatar")
      .populate("roleId", "roleName code status salaryRules")
      .populate("orgUnit", "name code status level");

    console.log(`👥 Found ${assignments.length} active assignments`);

    const employees = assignments.map(a => ({
      _id: a.employeeId._id,
      individualName: a.employeeId.individualName,
      personalEmail: a.employeeId.personalEmail,
      UserId: a.employeeId.UserId,
      avatar: a.employeeId.avatar,
      role: a.roleId,
      orgUnit: a.orgUnit,
      assignmentId: a._id,
      code: a.code,
      status: a.status,
      effectiveFrom: a.effectiveFrom,
      assignedBy: a.assignedBy
    }));

    res.status(200).json({ 
      success: true, 
      count: employees.length,
      orgUnitId,
      includesDescendants: descendants.length > 0,
      employees 
    });
  } catch (err) {
    console.error("❌ Error fetching employees by org unit:", err.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch employees",
      error: err.message 
    });
  }
};

// ---------------------- Get Employees by Department & Status ----------------------
export const getEmployeesByDepartmentAndStatus = async (req, res) => {
  try {
    const { code, status } = req.query;

    console.log(`📋 Filtering employees - Code: ${code}, Status: ${status}`);

    // Build filter
    const filter = { isActive: true };
    if (code) filter.code = code;
    if (status) filter.status = status;

    const assignments = await RoleAssignmentModel.find(filter)
      .populate("employeeId", "individualName personalEmail UserId avatar")
      .populate("roleId", "roleName code status")
      .populate("orgUnit", "name code status level");

    const employees = assignments.map(a => ({
      _id: a.employeeId._id,
      individualName: a.employeeId.individualName,
      personalEmail: a.employeeId.personalEmail,
      UserId: a.employeeId.UserId,
      avatar: a.employeeId.avatar,
      role: a.roleId,
      orgUnit: a.orgUnit,
      assignmentId: a._id,
      code: a.code,
      status: a.status,
    }));

    console.log(`👥 Found ${employees.length} employees matching filter`);

    res.status(200).json({ 
      success: true, 
      count: employees.length,
      filter,
      employees 
    });
  } catch (err) {
    console.error("❌ Error fetching employees by department:", err.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch employees",
      error: err.message 
    });
  }
};

// ---------------------- Get Org Units by Department ----------------------
export const getOrgUnitsByDepartment = async (req, res) => {
  try {
    const { code } = req.params;

    if (!["HR", "Finance", "BusinessOperation"].includes(code)) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid department code" 
      });
    }

    const units = await OrgUnitModel.find({ code })
      .populate("roleAssignment")
      .sort({ level: 1, name: 1 });

    console.log(`🏢 Found ${units.length} org units for department: ${code}`);

    res.status(200).json({ 
      success: true, 
      count: units.length,
      department: code,
      orgUnits: units 
    });
  } catch (err) {
    console.error("❌ Error fetching org units by department:", err.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch org units",
      error: err.message 
    });
  }
};
import mongoose from "mongoose";
import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";
import FinalizedEmployeesModel from "../models/HRModals/FinalizedEmployees.model.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import RoleModel from "../models/HRModals/Role.model.js";

const calculateLevel = async (parentId) => {
  if (!parentId) return 0;
  
  const parent = await OrgUnitModel.findById(parentId);
  if (!parent) return 0;
  
  return parent.level + 1;
};

const buildTree = (units, parentId = null) => {
  return units
    .filter((unit) => {
      if (!parentId && !unit.parent) return true;
      if (parentId && unit.parent) {
        return String(unit.parent) === String(parentId);
      }
      return false;
    })
    .map((unit) => ({
      _id: unit._id,
      name: unit.name,
      parent: unit.parent,
      level: unit.level,
      roleAssignment: unit.roleAssignment,
      children: buildTree(units, unit._id),
    }));
};

export const getOrgUnits = async (req, res) => {
  try {
    const units = await OrgUnitModel.find()
      .populate('roleAssignment')
      .lean();
    
    console.log(`📦 Fetched ${units.length} org units from database`);
    
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

export const getSingleOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;
    
    const orgUnit = await OrgUnitModel.findById(orgUnitId)
      .populate({
        path: 'roleAssignment',
        populate: {
          path: 'roleId',
          select: 'roleName category'
        }
      })
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

export const createOrgUnit = async (req, res) => {
  try {
    const { name, parent } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false,
        error: "Organization unit name is required" 
      });
    }

    const level = await calculateLevel(parent);

    const unit = new OrgUnitModel({ 
      name, 
      parent: parent || null,
      level,
    });

    await unit.save();

    console.log(`✅ Created OrgUnit: ${name} (Level: ${level})`);

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

export const updateOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;
    const { name, parent } = req.body;

    const unit = await OrgUnitModel.findById(orgUnitId);
    
    if (!unit) {
      return res.status(404).json({ 
        success: false,
        error: "Organization unit not found" 
      });
    }

    if (name) unit.name = name;
    
    if (parent !== undefined) {
      unit.parent = parent || null;
      unit.level = await calculateLevel(parent);
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

export const deleteOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;

    const children = await OrgUnitModel.countDocuments({ parent: orgUnitId });
    
    if (children > 0) {
      return res.status(400).json({ 
        success: false,
        error: `Cannot delete org unit with ${children} children. Delete children first.` 
      });
    }

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

    console.log(`📋 Fetching employees for OrgUnit: ${orgUnitId}`);

    let orgUnitIds = [orgUnitId];
    const descendants = await getDescendantUnitIds(orgUnitId);
    orgUnitIds = orgUnitIds.concat(descendants);

    console.log(`📦 Searching in ${orgUnitIds.length} org units (including descendants)`);

    const assignments = await RoleAssignmentModel.find({
      orgUnit: { $in: orgUnitIds },
      isActive: true,
    })
      .populate("employeeId", "individualName personalEmail UserId avatar")
      .populate("roleId", "roleName category")
      .populate("orgUnit", "name level");

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
      departmentCode: a.departmentCode,
      status: a.status,
      effectiveFrom: a.effectiveFrom,
      assignedBy: a.assignedBy,
      isExecutiveAccess: a.departmentCode === "All" || a.status === "All"
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

export const getEmployeesByDepartmentAndStatus = async (req, res) => {
  try {
    const { code, status } = req.query;

    console.log(`📋 Filtering employees - Code: ${code}, Status: ${status}`);

    const filter = { isActive: true };
    
    if (code && code !== "All") {
      filter.departmentCode = code;
    }
    
    if (status && status !== "All") {
      filter.status = status;
    }

    const assignments = await RoleAssignmentModel.find(filter)
      .populate("employeeId", "individualName personalEmail UserId avatar")
      .populate("roleId", "roleName category")
      .populate("orgUnit", "name level");

    const employees = assignments.map(a => ({
      _id: a.employeeId._id,
      individualName: a.employeeId.individualName,
      personalEmail: a.employeeId.personalEmail,
      UserId: a.employeeId.UserId,
      avatar: a.employeeId.avatar,
      role: a.roleId,
      orgUnit: a.orgUnit,
      assignmentId: a._id,
      departmentCode: a.departmentCode,
      status: a.status,
      isExecutiveAccess: a.departmentCode === "All" || a.status === "All"
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

export const getOrgUnitsByDepartment = async (req, res) => {
  try {
    const { code } = req.params;

    const validDepartments = ["HR", "Finance", "BusinessOperation", "All"];
    
    if (!validDepartments.includes(code)) {
      return res.status(400).json({ 
        success: false,
        error: `Invalid department code. Must be one of: ${validDepartments.join(", ")}` 
      });
    }

    let filter = {};
    
    if (code !== "All") {
      const assignments = await RoleAssignmentModel.find({ 
        departmentCode: code,
        isActive: true 
      }).distinct('orgUnit');
      
      filter._id = { $in: assignments };
    }

    const units = await OrgUnitModel.find(filter)
      .populate({
        path: 'roleAssignment',
        populate: {
          path: 'roleId',
          select: 'roleName category'
        }
      })
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
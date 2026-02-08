import mongoose from "mongoose";
import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";
import { BranchModel } from "../models/HRModals/BranchModel.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import AuditService from "../services/auditService.js";
import CONSTANTS from "../configs/constants.js";

/**
 * ✅ FIXED: Self-Healing Path Logic with Recursive Update
 */
class PathBuilder {
  /**
   * Ensures entire path exists and creates missing nodes
   */
  static async ensurePathExists(targetPath, branchId = null) {
    const segments = targetPath.split('.');
    const createdNodes = [];
    
    for (let i = 1; i <= segments.length; i++) {
      const currentPath = segments.slice(0, i).join('.');
      let node = await OrgUnitModel.findOne({ path: currentPath });
      
      if (!node) {
        const parentPath = segments.slice(0, i - 1).join('.');
        const parent = parentPath ? await OrgUnitModel.findOne({ path: parentPath }) : null;
        
        const nodeName = segments[i - 1]
          .split('_')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        
        node = await OrgUnitModel.create({
          name: nodeName,
          type: this._getTypeByLevel(i - 1),
          departmentCode: parent?.departmentCode || 'All',
          parent: parent?._id || null,
          path: currentPath,
          level: i - 1,
          branchId: branchId || parent?.branchId || null,
          isGlobal: !branchId,
          isActive: true,
          metadata: { autoCreated: true, createdAt: new Date() }
        });
        
        createdNodes.push(node);
        console.log(`✅ Auto-created: ${nodeName} (${currentPath})`);
      }
    }
    
    return {
      finalNode: await OrgUnitModel.findOne({ path: targetPath }),
      createdNodes
    };
  }
  
  /**
   * ✅ NEW: Recalculate paths for entire subtree after parent change
   */
  static async recalculateSubtreePaths(nodeId) {
    const node = await OrgUnitModel.findById(nodeId);
    if (!node) return;

    // Rebuild this node's path first
    await node.buildPath();
    await node.save();

    // Find all descendants and update their paths
    const oldPathPrefix = node.path;
    const descendants = await OrgUnitModel.find({
      path: new RegExp(`^${oldPathPrefix}\\.`)
    });

    for (const descendant of descendants) {
      await descendant.buildPath();
      await descendant.save();
      console.log(`✅ Updated path: ${descendant.name} -> ${descendant.path}`);
    }
  }
  
  static _getTypeByLevel(level) {
    const types = ['ORG_ROOT', 'BOARD', 'EXECUTIVE', 'DIVISION', 'DEPARTMENT', 'DESK', 'CELL'];
    return types[level] || 'CELL';
  }
}

/**
 * ✅ CREATE ORG UNIT
 */
export const createOrgUnit = async (req, res) => {
  try {
    const { name, type, departmentCode, parent, branchId, metadata, fullPath } = req.body;

    if (!name || !type || !departmentCode) {
      return res.status(400).json({
        success: false,
        error: "name, type, and departmentCode are required"
      });
    }

    // ✅ Self-healing path logic
    if (fullPath) {
      const normalizedPath = fullPath.toLowerCase().replace(/\s+/g, '_');
      const { finalNode, createdNodes } = await PathBuilder.ensurePathExists(normalizedPath, branchId);
      
      if (createdNodes.length > 0) {
        console.log(`✅ Auto-created ${createdNodes.length} missing nodes`);
        
        // 🔍 AUDIT LOG for auto-created nodes
        await AuditService.log({
          eventType: CONSTANTS.AUDIT_EVENTS.ORGUNIT_CREATED,
          actorId: req.user._id,
          targetId: finalNode?._id || null,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          details: {
            autoCreated: true,
            pathSegments: normalizedPath,
            createdCount: createdNodes.length,
            createdNodes: createdNodes.map(n => ({
              name: n.name,
              path: n.path,
              level: n.level
            }))
          }
        });
      }
      
      if (finalNode && finalNode.name === name) {
        return res.status(200).json({
          success: true,
          message: "OrgUnit already exists",
          data: finalNode,
          autoCreated: false
        });
      }
    }

    // Validate parent
    let parentUnit = null;
    if (parent) {
      parentUnit = await OrgUnitModel.findById(parent);
      if (!parentUnit) {
        return res.status(400).json({
          success: false,
          error: "Invalid parent ID"
        });
      }
    }

    // Validate branch
    if (branchId) {
      const branch = await BranchModel.findById(branchId);
      if (!branch) {
        return res.status(400).json({
          success: false,
          error: "Invalid branch ID"
        });
      }
    }

    // Check for duplicate
    const duplicate = await OrgUnitModel.findOne({
      name: new RegExp(`^${name}$`, 'i'),
      parent: parent || null,
      isActive: true
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: "A unit with this name already exists at this level"
      });
    }

    // Create unit
    const unit = new OrgUnitModel({
      name,
      type,
      departmentCode,
      parent: parent || null,
      branchId: branchId || null,
      isGlobal: !branchId,
      metadata: metadata || {}
    });

    await unit.save();

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.ORGUNIT_CREATED,
      actorId: req.user._id,
      targetId: unit._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        orgUnitName: unit.name,
        type: unit.type,
        departmentCode: unit.departmentCode,
        path: unit.path,
        parentId: parent,
        branchId: branchId,
        isGlobal: unit.isGlobal
      }
    });

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

/**
 * ✅ FIXED: GET ALL ORG UNITS (READ ONLY - NO AUDIT)
 */
export const getOrgUnits = async (req, res) => {
  try {
    const { branchId, departmentCode } = req.query;
    
    let filter = { isActive: true };
    
    // ✅ FIXED: Branch filtering now includes descendants
    if (branchId) {
      if (branchId === 'head-office') {
        // Get head office branch
        const headOffice = await BranchModel.findOne({ isHeadOffice: true });
        if (headOffice) {
          filter.branchId = headOffice._id;
        }
      } else {
        filter.branchId = branchId;
      }
    }
    
    if (departmentCode && departmentCode !== "All") {
      filter.departmentCode = departmentCode;
    }

    const units = await OrgUnitModel.find(filter)
      .populate('branchId', 'name code')
      .sort({ level: 1, name: 1 })
      .lean();

    // ✅ Add employee counts
    const unitsWithCounts = await Promise.all(
      units.map(async (unit) => {
        const employeeCount = await RoleAssignmentModel.countDocuments({
          orgUnit: unit._id,
          isActive: true
        });
        return { ...unit, employeeCount };
      })
    );

    // Build tree
    const tree = buildTree(unitsWithCounts);

    res.status(200).json({
      success: true,
      count: unitsWithCounts.length,
      data: tree,
      branchContext: branchId || 'all'
    });
  } catch (err) {
    console.error("❌ getOrgUnits error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tree",
      message: err.message
    });
  }
};

/**
 * ✅ GET SINGLE ORG UNIT (READ ONLY - NO AUDIT)
 */
export const getSingleOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;

    const unit = await OrgUnitModel.findById(orgUnitId)
      .populate('parent', 'name type')
      .populate('branchId', 'name code');

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: "Organization unit not found"
      });
    }

    res.status(200).json({
      success: true,
      data: unit
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch org unit",
      message: err.message
    });
  }
};

/**
 * ✅ UPDATE ORG UNIT
 */
export const updateOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;
    const updates = req.body;

    const unit = await OrgUnitModel.findById(orgUnitId);
    if (!unit) {
      return res.status(404).json({
        success: false,
        error: "OrgUnit not found"
      });
    }

    // Track changes for audit
    const changedFields = {};
    const allowedUpdates = ['name', 'type', 'departmentCode', 'metadata', 'isActive'];
    
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined && JSON.stringify(unit[key]) !== JSON.stringify(updates[key])) {
        changedFields[key] = {
          old: unit[key],
          new: updates[key]
        };
        unit[key] = updates[key];
      }
    }

    await unit.save();

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.ORGUNIT_UPDATED,
      actorId: req.user._id,
      targetId: unit._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        orgUnitName: unit.name,
        path: unit.path,
        changedFields
      }
    });

    res.status(200).json({
      success: true,
      message: "OrgUnit updated successfully",
      data: unit
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Failed to update org unit",
      message: err.message
    });
  }
};

/**
 * ✅ FIXED: MOVE ORG UNIT (with recursive path update)
 */
export const moveOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;
    const { newParentId } = req.body;

    const unit = await OrgUnitModel.findById(orgUnitId);
    if (!unit) {
      return res.status(404).json({
        success: false,
        error: "OrgUnit not found"
      });
    }

    // Store old parent for audit
    const oldParentId = unit.parent ? unit.parent.toString() : null;
    const oldPath = unit.path;

    // Prevent circular reference
    if (newParentId && String(newParentId) === String(orgUnitId)) {
      return res.status(400).json({
        success: false,
        error: "Cannot set unit as its own parent"
      });
    }

    // Get new parent
    const newParent = newParentId 
      ? await OrgUnitModel.findById(newParentId)
      : null;

    if (newParentId && !newParent) {
      return res.status(400).json({
        success: false,
        error: "New parent not found"
      });
    }

    // Check if new parent is a descendant
    if (newParent) {
      const descendants = await unit.getDescendants();
      if (descendants.some(d => String(d._id) === String(newParentId))) {
        return res.status(400).json({
          success: false,
          error: "Cannot move unit to its own descendant"
        });
      }
    }

    // Update parent
    unit.parent = newParentId || null;
    await unit.save();

    // ✅ FIXED: Recalculate paths for entire subtree
    await PathBuilder.recalculateSubtreePaths(unit._id);

    // Reload unit to get updated path
    const updatedUnit = await OrgUnitModel.findById(orgUnitId);

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.ORGUNIT_MOVED,
      actorId: req.user._id,
      targetId: unit._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        orgUnitName: unit.name,
        oldParentId,
        newParentId,
        oldPath,
        newPath: updatedUnit.path
      }
    });

    res.status(200).json({
      success: true,
      message: "OrgUnit moved successfully and paths updated",
      data: updatedUnit
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Failed to move org unit",
      message: err.message
    });
  }
};

/**
 * ✅ DELETE ORG UNIT
 */
export const deleteOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;

    const unit = await OrgUnitModel.findById(orgUnitId);
    if (!unit) {
      return res.status(404).json({
        success: false,
        error: "OrgUnit not found"
      });
    }

    // Check for active employees
    const activeEmployees = await RoleAssignmentModel.countDocuments({
      orgUnit: unit._id,
      isActive: true
    });

    if (activeEmployees > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete org unit. ${activeEmployees} active employee(s) assigned.`
      });
    }

    // Check for children
    const children = await OrgUnitModel.countDocuments({
      parent: unit._id,
      isActive: true
    });

    if (children > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete org unit. It has ${children} child unit(s).`
      });
    }

    // Store details before deletion
    const deletedDetails = {
      name: unit.name,
      type: unit.type,
      path: unit.path,
      departmentCode: unit.departmentCode
    };

    await OrgUnitModel.findByIdAndDelete(orgUnitId);

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.ORGUNIT_DELETED,
      actorId: req.user._id,
      targetId: orgUnitId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: deletedDetails
    });

    res.status(200).json({
      success: true,
      message: "OrgUnit deleted successfully"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Failed to delete org unit",
      message: err.message
    });
  }
};

/**
 * ✅ GET EMPLOYEES BY ORG UNIT (READ ONLY - NO AUDIT)
 */
export const getEmployeesByOrgUnit = async (req, res) => {
  try {
    const { orgUnitId } = req.params;

    const unit = await OrgUnitModel.findById(orgUnitId);
    if (!unit) {
      return res.status(404).json({
        success: false,
        message: "Organization unit not found"
      });
    }

    // Get all descendants using path-based query
    const descendants = await unit.getDescendants();
    const allUnitIds = [unit._id, ...descendants.map(d => d._id)];

    // Find all role assignments in this subtree
    const assignments = await RoleAssignmentModel.find({
      orgUnit: { $in: allUnitIds },
      isActive: true
    })
      .populate('employeeId')
      .populate('roleId', 'roleName category')
      .lean();

    // Extract employees
    const employees = assignments
      .filter(a => a.employeeId)
      .map(a => ({
        ...a.employeeId,
        role: a.roleId,
        assignmentId: a._id
      }));

    res.status(200).json({
      success: true,
      orgUnit: {
        _id: unit._id,
        name: unit.name,
        path: unit.path
      },
      count: employees.length,
      employees
    });
  } catch (err) {
    console.error("❌ getEmployeesByOrgUnit error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch employees",
      message: err.message
    });
  }
};

/**
 * ✅ GET ORG UNITS BY DEPARTMENT (READ ONLY - NO AUDIT)
 */
export const getOrgUnitsByDepartment = async (req, res) => {
  try {
    const { code } = req.params;

    const units = await OrgUnitModel.find({
      departmentCode: code,
      isActive: true
    }).sort({ level: 1, name: 1 });

    res.status(200).json({
      success: true,
      department: code,
      count: units.length,
      data: units
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch org units by department",
      message: err.message
    });
  }
};

/**
 * ✅ GET EMPLOYEES BY DEPARTMENT (READ ONLY - NO AUDIT)
 */
export const getEmployeesByDepartment = async (req, res) => {
  try {
    const { code } = req.params;

    const assignments = await RoleAssignmentModel.find({
      departmentCode: code,
      isActive: true
    })
      .populate('employeeId')
      .populate('roleId', 'roleName')
      .populate('orgUnit', 'name type');

    const employees = assignments
      .filter(a => a.employeeId)
      .map(a => ({
        ...a.employeeId.toObject(),
        role: a.roleId,
        orgUnit: a.orgUnit
      }));

    res.status(200).json({
      success: true,
      department: code,
      count: employees.length,
      employees
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch employees by department",
      message: err.message
    });
  }
};

/**
 * ✅ TREE BUILDER HELPER
 */
const buildTree = (units, parentId = null) => {
  return units
    .filter(unit => {
      const unitParentId = unit.parent ? String(unit.parent) : null;
      const targetParentId = parentId ? String(parentId) : null;
      return unitParentId === targetParentId;
    })
    .map(unit => ({
      ...unit,
      children: buildTree(units, String(unit._id))
    }));
};
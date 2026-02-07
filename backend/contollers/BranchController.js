// ============================================
// FILE: controllers/branchController.js
// Complete Branch Management Controller with Audit Logging
// ============================================

import { BranchModel } from "../models/HRModals/BranchModel.js";
import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import AuditService from "../services/auditService.js";
import CONSTANTS from "../configs/constants.js";

/**
 * ✅ Create new branch
 */
export const createBranch = async (req, res) => {
  try {
    const { 
      name, 
      code, 
      location, 
      branchType, 
      contactInfo,
      manager,
      isHeadOffice 
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        error: "Name and code are required"
      });
    }

    // Check for duplicates
    const existing = await BranchModel.findOne({
      $or: [
        { name: new RegExp(`^${name}$`, 'i') },
        { code: code.toUpperCase() }
      ]
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Branch with this name or code already exists"
      });
    }

    const branch = await BranchModel.create({
      name,
      code: code.toUpperCase(),
      location: location || {},
      branchType: branchType || "Local",
      contactInfo: contactInfo || {},
      manager: manager || null,
      isHeadOffice: isHeadOffice || false,
      isActive: true,
      openedDate: new Date()
    });

    console.log(`✅ Created branch: ${branch.name} (${branch.code})`);

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.BRANCH_CREATED,
      actorId: req.user._id,
      targetId: branch._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        branchName: branch.name,
        branchCode: branch.code,
        branchType: branch.branchType,
        isHeadOffice: branch.isHeadOffice,
        location: branch.location
      }
    });

    res.status(201).json({
      message: "Branch created successfully",
      success: true,
      data: branch
    });
  } catch (err) {
    console.error("❌ createBranch error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to create branch",
      message: err.message
    });
  }
};

/**
 * ✅ Get all branches (READ ONLY - NO AUDIT)
 */
export const getAllBranches = async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const filter = {};
    if (!includeInactive || includeInactive === 'false') {
      filter.isActive = true;
    }

    const branches = await BranchModel.find(filter)
      .populate('manager', 'individualName personalEmail UserId')
      .sort({ code: 1 });

    // Get employee counts for each branch
    const branchesWithCounts = await Promise.all(
      branches.map(async (branch) => {
        const employeeCount = await branch.getEmployeeCount();
        const departmentBreakdown = await branch.getDepartmentBreakdown();
        
        return {
          ...branch.toObject(),
          employeeCount,
          departmentBreakdown
        };
      })
    );

    res.status(200).json({
      message: "Branches found",
      success: true,
      count: branchesWithCounts.length,
      branches: branchesWithCounts
    });
  } catch (err) {
    console.error("❌ getAllBranches error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch branches",
      message: err.message
    });
  }
};

/**
 * ✅ Get single branch by ID (READ ONLY - NO AUDIT)
 */
export const getBranchById = async (req, res) => {
  try {
    const { branchId } = req.params;

    const branch = await BranchModel.findById(branchId)
      .populate('manager', 'individualName personalEmail UserId avatar');

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found"
      });
    }

    // Get additional stats
    const employeeCount = await branch.getEmployeeCount();
    const departmentBreakdown = await branch.getDepartmentBreakdown();
    
    const orgUnitsCount = await OrgUnitModel.countDocuments({
      branchId: branch._id,
      isActive: true
    });

    res.status(200).json({
      message: "Branch found",
      success: true,
      data: {
        ...branch.toObject(),
        employeeCount,
        departmentBreakdown,
        orgUnitsCount
      }
    });
  } catch (err) {
    console.error("❌ getBranchById error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch branch",
      message: err.message
    });
  }
};

/**
 * ✅ Update branch
 */
export const updateBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const updates = req.body;

    const branch = await BranchModel.findById(branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        error: "Branch not found"
      });
    }

    // Track changes for audit
    const changedFields = {};
    const allowedUpdates = [
      'name', 'code', 'location', 'branchType', 
      'contactInfo', 'manager', 'isActive', 
      'isHeadOffice', 'metadata'
    ];

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined && JSON.stringify(branch[key]) !== JSON.stringify(updates[key])) {
        changedFields[key] = {
          old: branch[key],
          new: updates[key]
        };
      }
    }

    // Prevent changing head office status if employees assigned
    if (updates.isHeadOffice !== undefined && 
        updates.isHeadOffice !== branch.isHeadOffice) {
      const employeeCount = await RoleAssignmentModel.countDocuments({
        branchId: branch._id,
        isActive: true
      });

      if (employeeCount > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot change head office status. ${employeeCount} employees are assigned to this branch.`
        });
      }
    }

    // Update fields
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        branch[key] = updates[key];
      }
    }

    await branch.save();

    console.log(`✅ Updated branch: ${branch.name}`);

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.BRANCH_UPDATED,
      actorId: req.user._id,
      targetId: branch._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        branchName: branch.name,
        branchCode: branch.code,
        changedFields
      }
    });

    res.status(200).json({
      message: "Branch updated successfully",
      success: true,
      data: branch
    });
  } catch (err) {
    console.error("❌ updateBranch error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to update branch",
      message: err.message
    });
  }
};

/**
 * ✅ Delete branch
 */
export const deleteBranch = async (req, res) => {
  try {
    const { branchId } = req.params;

    const branch = await BranchModel.findById(branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        error: "Branch not found"
      });
    }

    // Prevent deletion of head office
    if (branch.isHeadOffice) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete head office branch"
      });
    }

    // Check for active employees
    const activeEmployees = await RoleAssignmentModel.countDocuments({
      branchId: branch._id,
      isActive: true
    });

    if (activeEmployees > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete branch. ${activeEmployees} active employee assignment(s) exist.`
      });
    }

    // Check for org units
    const activeOrgUnits = await OrgUnitModel.countDocuments({
      branchId: branch._id,
      isActive: true
    });

    if (activeOrgUnits > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete branch. ${activeOrgUnits} active org unit(s) exist.`
      });
    }

    // Store branch details before deletion
    const deletedBranchDetails = {
      name: branch.name,
      code: branch.code,
      branchType: branch.branchType
    };

    await BranchModel.findByIdAndDelete(branchId);

    console.log(`✅ Deleted branch: ${branch.name}`);

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.BRANCH_DELETED,
      actorId: req.user._id,
      targetId: branchId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: deletedBranchDetails
    });

    res.status(200).json({
      message: "Branch deleted successfully",
      success: true
    });
  } catch (err) {
    console.error("❌ deleteBranch error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete branch",
      message: err.message
    });
  }
};

/**
 * ✅ Get branch with all org units (READ ONLY - NO AUDIT)
 */
export const getBranchWithOrgUnits = async (req, res) => {
  try {
    const { branchId } = req.params;

    const branch = await BranchModel.findById(branchId)
      .populate('manager', 'individualName personalEmail');

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found"
      });
    }

    // Get all org units in this branch
    const orgUnits = await OrgUnitModel.find({
      branchId: branch._id,
      isActive: true
    }).sort({ level: 1, name: 1 });

    // Build tree structure
    const buildTree = (units, parentId = null) => {
      return units
        .filter(u => {
          const unitParent = u.parent ? u.parent.toString() : null;
          return unitParent === parentId;
        })
        .map(u => ({
          ...u.toObject(),
          children: buildTree(units, u._id.toString())
        }));
    };

    const tree = buildTree(orgUnits);

    res.status(200).json({
      message: "Branch with org units found",
      success: true,
      data: {
        branch: branch.toObject(),
        orgUnitsCount: orgUnits.length,
        orgUnitsTree: tree
      }
    });
  } catch (err) {
    console.error("❌ getBranchWithOrgUnits error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch branch with org units",
      message: err.message
    });
  }
};

/**
 * ✅ Get head office (READ ONLY - NO AUDIT)
 */
export const getHeadOffice = async (req, res) => {
  try {
    const headOffice = await BranchModel.getHeadOffice();

    if (!headOffice) {
      return res.status(404).json({
        success: false,
        message: "Head office not found"
      });
    }

    const employeeCount = await headOffice.getEmployeeCount();
    const departmentBreakdown = await headOffice.getDepartmentBreakdown();

    res.status(200).json({
      message: "Head office found",
      success: true,
      data: {
        ...headOffice.toObject(),
        employeeCount,
        departmentBreakdown
      }
    });
  } catch (err) {
    console.error("❌ getHeadOffice error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch head office",
      message: err.message
    });
  }
};

/**
 * ✅ Get branch statistics (READ ONLY - NO AUDIT)
 */
export const getBranchStats = async (req, res) => {
  try {
    const { branchId } = req.params;

    const branch = await BranchModel.findById(branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found"
      });
    }

    const employeeCount = await RoleAssignmentModel.countDocuments({
      branchId: branch._id,
      isActive: true
    });

    const orgUnitsCount = await OrgUnitModel.countDocuments({
      branchId: branch._id,
      isActive: true
    });

    const departmentBreakdown = await RoleAssignmentModel.aggregate([
      { $match: { branchId: branch._id, isActive: true } },
      { 
        $group: { 
          _id: "$departmentCode", 
          count: { $sum: 1 } 
        }
      },
      { $sort: { count: -1 } }
    ]);

    const roleBreakdown = await RoleAssignmentModel.aggregate([
      { $match: { branchId: branch._id, isActive: true } },
      {
        $lookup: {
          from: "roles",
          localField: "roleId",
          foreignField: "_id",
          as: "role"
        }
      },
      { $unwind: "$role" },
      {
        $group: {
          _id: "$role.roleName",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      message: "Branch statistics",
      success: true,
      data: {
        branch: {
          _id: branch._id,
          name: branch.name,
          code: branch.code
        },
        employeeCount,
        orgUnitsCount,
        departmentBreakdown,
        topRoles: roleBreakdown
      }
    });
  } catch (err) {
    console.error("❌ getBranchStats error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch branch statistics",
      message: err.message
    });
  }
};
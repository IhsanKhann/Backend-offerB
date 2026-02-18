import jwt from "jsonwebtoken";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import RoleModel from "../models/HRModals/Role.model.js";
import { PermissionModel } from "../models/HRModals/Permissions.model.js";
import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import PermissionAggregator from "../utilis/permissionAggregation.js";
import dotenv from "dotenv";

import { HierarchyGuard } from "./hierarchyGuard.js";
import AuditService from "../services/auditService.js";
import CONSTANTS from "../configs/constants.js";
console.log("Loading logs in auth: The departments: ", CONSTANTS.DEPARTMENTS);

dotenv.config();

// ========================================
// ✅ FIXED: Dynamic Permission Aggregation
// ========================================
export const getPermissionsForUser = async (user) => {
  try {
    // Use the PermissionAggregator to get effective permissions
    const { effective, isExecutive } = await PermissionAggregator.getEffectivePermissions(user._id);
    
    // Convert to Set of permission names/actions
    const permSet = new Set();
    effective.forEach(perm => {
      permSet.add(perm.name);
      if (perm.action) permSet.add(perm.action);
    });

    return permSet;
  } catch (err) {
    console.error("❌ getPermissionsForUser error:", err);
    return new Set(); // Return empty set on error
  }
};

// ========================================
// UTILITY: Get Root OrgUnit (Department)
// ========================================
export const getRootOrgUnit = async (orgUnitId) => {
  if (!orgUnitId) return null;
  
  let unit = await OrgUnitModel.findById(orgUnitId);
  if (!unit) return null;

  // Traverse up to root
  while (unit.parent) {
    unit = await OrgUnitModel.findById(unit.parent);
    if (!unit) break;
  }

  return unit;
};

// ========================================
// ✅ FIXED: Get All Descendant OrgUnits (Path-based)
// ========================================
export const getAllDescendants = async (orgUnitId) => {
  try {
    const orgUnit = await OrgUnitModel.findById(orgUnitId);
    if (!orgUnit || !orgUnit.path) return [];

    // Use path-based regex for efficient descendant lookup
    const pathRegex = new RegExp(`^${orgUnit.path}\\.`);
    const descendants = await OrgUnitModel.find({
      path: pathRegex,
      isActive: true
    });

    return descendants.map(d => d._id);
  } catch (err) {
    console.error("❌ getAllDescendants error:", err);
    return [];
  }
};

// ========================================
// ✅ FIXED: Check if User is Ancestor (Path-based)
// ========================================
export const isAncestorOf = async (ancestorOrgUnitId, descendantOrgUnitId) => {
  if (!ancestorOrgUnitId || !descendantOrgUnitId) return false;
  
  if (ancestorOrgUnitId.toString() === descendantOrgUnitId.toString()) {
    return true; // Same unit
  }

  try {
    const [ancestor, descendant] = await Promise.all([
      OrgUnitModel.findById(ancestorOrgUnitId),
      OrgUnitModel.findById(descendantOrgUnitId)
    ]);

    if (!ancestor || !descendant || !ancestor.path || !descendant.path) {
      return false;
    }

    // Check if descendant's path starts with ancestor's path
    return descendant.path.startsWith(ancestor.path + '.') || 
           descendant.path === ancestor.path;
  } catch (err) {
    console.error("❌ isAncestorOf error:", err);
    return false;
  }
};

// ========================================
// ✅ FIXED: Check Employee Status - NOW ATTACHES EMPLOYEE
// ========================================
export const checkEmployeeStatus = async (req, res, next) => {
  try {
    const { UserId } = req.body;

    // If no UserId, skip checks (let login handle it)
    if (!UserId) {
      return next();
    }

    const employee = await FinalizedEmployee.findOne({ UserId });

    // ✅ FIX: If employee not found, let loginUser handle it
    if (!employee) {
      console.log(`⚠️  Employee not found for UserId: ${UserId}`);
      return next();
    }

    // ✅ CRITICAL FIX: Attach employee to request
    req.employee = employee;

    // Check blocked
    if (employee.blocked?.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked",
        code: "ACCOUNT_BLOCKED",
        details: {
          reason: employee.blocked.reason,
          blockedAt: employee.blocked.blockedAt
        }
      });
    }

    // Check terminated
    if (employee.terminated?.isTerminated) {
      return res.status(403).json({
        success: false,
        message: "Your account has been terminated",
        code: "ACCOUNT_TERMINATED",
        details: {
          reason: employee.terminated.reason,
          terminatedAt: employee.terminated.terminatedAt
        }
      });
    }

    // Check suspended
    if (employee.suspension?.isSuspended) {
      return res.status(403).json({
        success: false,
        message: "Your account is currently suspended",
        code: "ACCOUNT_SUSPENDED",
        details: {
          reason: employee.suspension.reason,
          suspendedAt: employee.suspension.suspendedAt,
          suspendedUntil: employee.suspension.suspendedUntil
        }
      });
    }

    // All checks passed, proceed to login
    console.log(`✅ Employee status check passed for ${employee.individualName}`);
    next();

  } catch (error) {
    console.error("❌ Employee status check error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during status check",
      error: error.message
    });
  }
};


// ========================================
// MIDDLEWARE: Authenticate User
// ========================================
export const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken || 
                  req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
        code: "NO_TOKEN"
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Fetch user
    const user = await FinalizedEmployee.findById(decoded._id)
      .select('-password -passwordHash -refreshToken');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    // Check if user is active
    if (user.blocked?.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Account is blocked",
        code: "ACCOUNT_BLOCKED"
      });
    }

    if (user.terminated?.isTerminated) {
      return res.status(403).json({
        success: false,
        message: "Account is terminated",
        code: "ACCOUNT_TERMINATED"
      });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    console.error("Authentication error:", error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token expired",
        code: "TOKEN_EXPIRED"
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
        code: "INVALID_TOKEN"
      });
    }

    res.status(500).json({
      success: false,
      message: "Authentication failed",
      error: error.message
    });
  }
};

// ========================================
// Check Auth Status
// ========================================
export const checkAuth = async (req, res) => {
  try {
    const user = req.user;

    // Get role assignment
    const assignment = await RoleAssignmentModel.findOne({
      employeeId: user._id,
      isActive: true
    })
      .populate('roleId', 'roleName category')
      .populate('orgUnit', 'name code level path')
      .populate('branchId', 'name code isHeadOffice');

    // Get permissions
    const permissionData = await PermissionAggregator.getEffectivePermissions(user._id);

    res.status(200).json({
      success: true,
      authenticated: true,
      user: {
        _id: user._id,
        UserId: user.UserId,
        individualName: user.individualName,
        personalEmail: user.personalEmail,
        officialEmail: user.officialEmail,
        role: assignment?.roleId?.roleName,
        roleCategory: assignment?.roleId?.category,
        department: assignment?.departmentCode,
        orgUnit: assignment?.orgUnit?.name,
        orgUnitLevel: assignment?.orgUnit?.level,
        orgUnitPath: assignment?.orgUnit?.path,
        branch: assignment?.branchId?.name,
        isExecutive: permissionData.isExecutive,
        permissions: {
          direct: permissionData.direct.length,
          inherited: permissionData.inherited.length,
          total: permissionData.effective.length
        }
      }
    });
  } catch (error) {
    console.error("Check auth error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check authentication",
      error: error.message
    });
  }
};

export const authorize = (requiredPermission, options = {}) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          code: "NOT_AUTHENTICATED"
        });
      }

      // Get user's role assignment
      const assignment = await RoleAssignmentModel.findOne({
        employeeId: userId,
        isActive: true
      })
        .populate('orgUnit')
        .populate('roleId');

      if (!assignment) {
        await AuditService.log({
          eventType: CONSTANTS.AUDIT_EVENTS.PERMISSION_DENIED,
          actorId: userId,
          details: {
            reason: 'NO_ASSIGNMENT',
            requiredPermission,
            route: req.path
          }
        });

        return res.status(403).json({
          success: false,
          message: "No active role assignment found",
          code: "NO_ASSIGNMENT"
        });
      }

      // ✅ Get aggregated permissions with statusScope filtering
      const { effective: permissions, departmentCode, isExecutive } = 
        await PermissionAggregator.getEffectivePermissions(userId);

      console.log(`🔐 Auth Check for ${req.user.individualName}:`);
      console.log(`   Permission: ${requiredPermission}`);
      console.log(`   Department: ${departmentCode}`);
      console.log(`   Is Executive: ${isExecutive}`);
      console.log(`   Total Permissions: ${permissions.length}`);

      // ✅ FIXED: Find permission object (check both 'action' and 'name' fields)
      const permissionObject = permissions.find(p => 
        p.action === requiredPermission || p.name === requiredPermission
      );

      if (!permissionObject) {
        // Log permission denial
        await AuditService.log({
          eventType: CONSTANTS.AUDIT_EVENTS.PERMISSION_DENIED,
          actorId: userId,
          details: {
            reason: 'PERMISSION_NOT_FOUND',
            requiredPermission,
            userPermissions: permissions.map(p => p.action || p.name),
            departmentCode,
            route: req.path
          }
        });

        console.log(`   ❌ Permission "${requiredPermission}" not found`);
        console.log(`   Available permissions:`, permissions.map(p => p.action || p.name));

        return res.status(403).json({
          success: false,
          message: `Permission denied: ${requiredPermission}`,
          code: "PERMISSION_DENIED",
          details: {
            requiredPermission,
            userDepartment: departmentCode,
            isExecutive,
            availablePermissions: permissions.length
          }
        });
      }

      console.log(`   ✅ Permission found: ${permissionObject.name}`);

      // ✅ Validate resourceType if specified
      if (options.resourceType) {
        if (permissionObject.resourceType && 
            permissionObject.resourceType !== 'ALL' &&
            permissionObject.resourceType !== options.resourceType) {
          
          console.log(`   ❌ Resource type mismatch: expected ${options.resourceType}, got ${permissionObject.resourceType}`);

          return res.status(403).json({
            success: false,
            message: `Permission not applicable to resource type: ${options.resourceType}`,
            code: "RESOURCE_TYPE_MISMATCH"
          });
        }
      }

      // ✅ CRITICAL: Store permission info for hierarchy guard
      req.permissionCheck = {
        action: permissionObject.action || permissionObject.name,
        permission: permissionObject,
        hierarchyScope: permissionObject.hierarchyScope,
        statusScope: permissionObject.statusScope,
        resourceType: permissionObject.resourceType,
        bypassHierarchy: options.bypassHierarchy || false
      };

      // ✅ Store user context
      req.userContext = {
        userId,
        assignment,
        departmentCode,
        isExecutive,
        orgUnit: assignment.orgUnit,
        level: assignment.orgUnit?.level,
        roleCategory: assignment.roleId?.category
      };

      console.log(`   ✅ Authorization passed\n`);

      next();

    } catch (error) {
      console.error("❌ Authorization error:", error);
      
      res.status(500).json({
        success: false,
        message: "Authorization check failed",
        error: error.message
      });
    }
  };
};


// ========================================
// MIDDLEWARE: Verify Partner API Key
// ========================================
export const verifyPartner = (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      return res.status(401).json({ 
        success: false, 
        message: "Missing API Key" 
      });
    }

    if (apiKey !== process.env.PARTNER_API_KEY) {
      return res.status(403).json({ 
        success: false, 
        message: "Invalid API Key" 
      });
    }

    next();
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: "Server Error" 
    });
  }
};

// ========================================
// UTILITY: Require Any Permission
// ========================================
export const requireAnyPermission = (permissions = []) => {
  return async (req, res, next) => {
    try {
      const userPermissions = await getPermissionsForUser(req.user);

      const hasAny = permissions.some(p => userPermissions.has(p));

      if (!hasAny) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Requires one of: ${permissions.join(', ')}`
        });
      }

      next();
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Authorization error",
        error: err.message
      });
    }
  };
};

// ========================================
// UTILITY: Require All Permissions
// ========================================
export const requireAllPermissions = (permissions = []) => {
  return async (req, res, next) => {
    try {
      const userPermissions = await getPermissionsForUser(req.user);

      const hasAll = permissions.every(p => userPermissions.has(p));

      if (!hasAll) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Requires all of: ${permissions.join(', ')}`
        });
      }

      next();
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Authorization error",
        error: err.message
      });
    }
  };
};
import jwt from "jsonwebtoken";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import RoleModel from "../models/HRModals/Role.model.js";
import { PermissionModel } from "../models/HRModals/Permissions.model.js";
import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import PermissionAggregator from "../utilis/permissionAggregation.js";
import dotenv from "dotenv";

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
// MIDDLEWARE: Check Employee Status
// ========================================
export const checkEmployeeStatus = async (req, res, next) => {
  try {
    const { email, UserId } = req.body;

    if (!email && !UserId) {
      return res.status(400).json({ message: "Email or UserId is required" });
    }

    const employee =
      (email && (await FinalizedEmployee.findOne({ personalEmail: email }))) ||
      (UserId && (await FinalizedEmployee.findOne({ UserId }))) ||
      null;

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const status = employee.profileStatus?.decision;

    if (["Suspended", "Blocked", "Terminated"].includes(status)) {
      return res.status(403).json({
        message: `Access denied. Employee status is '${status}'`,
        suspension: employee.suspension || {},
        block: employee.blocked || {},
        termination: employee.terminated || {},
      });
    }

    req.employee = employee;
    next();
  } catch (err) {
    console.error("Error in checkEmployeeStatus:", err);
    res.status(500).json({
      message: "Error checking employee status",
      error: err.message,
    });
  }
};

// ========================================
// MIDDLEWARE: Authenticate User
// ========================================
export const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - No token provided",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      const msg = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
      return res.status(401).json({ status: false, message: msg });
    }

    const user = await FinalizedEmployee.findById(decoded._id);
    if (!user) {
      return res.status(401).json({ 
        status: false, 
        message: "Unauthorized - user not found" 
      });
    }

    // ✅ Attach role assignment with department info
    const assignment = await RoleAssignmentModel.findOne({
      employeeId: user._id,
      isActive: true
    }).populate('roleId').populate('orgUnit');

    if (assignment) {
      req.userAssignment = assignment;
      req.userDepartment = assignment.departmentCode;
      req.userOrgUnit = assignment.orgUnit;
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Authenticate error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

// ========================================
// Check Auth Status
// ========================================
export const checkAuth = async (req, res) => {
  try {
    let token = req.cookies?.accessToken;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    
    if (!token) {
      return res.status(401).json({ 
        status: false, 
        message: "Not authenticated" 
      });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await FinalizedEmployee.findById(decoded._id).select("-password -passwordHash");

    if (!user) {
      return res.status(404).json({ 
        status: false, 
        message: "User not found" 
      });
    }

    // Get active role assignment
    const assignment = await RoleAssignmentModel.findOne({
      employeeId: user._id,
      isActive: true
    })
    .populate('roleId')
    .populate('orgUnit');

    let department = assignment?.departmentCode || null;
    
    // Convert "All" to array of all departments for frontend
    let accessibleDepartments = [];
    if (department === "All") {
      accessibleDepartments = ["HR", "Finance", "BusinessOperation", "IT", "Compliance"];
    } else if (department) {
      accessibleDepartments = [department];
    }

    const userResponse = {
      ...user.toObject(),
      department: department,
      departmentCode: department,
      accessibleDepartments: accessibleDepartments,
      role: assignment?.roleId || null,
      orgUnit: assignment?.orgUnit || null,
    };

    return res.status(200).json({ 
      status: true, 
      user: userResponse
    });

  } catch (error) {
    console.error("checkAuth error:", error);
    return res.status(401).json({ 
      status: false, 
      message: "Invalid or expired token" 
    });
  }
};

// ========================================
// 🔥 AUTHORIZATION MIDDLEWARE (INTENTIONAL SUPERUSER BYPASS)
// ========================================
export const authorize = (requiredPermission, options = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const userAssignment = req.userAssignment;
      const userDepartment = req.userDepartment;

      // Debug bypass (remove in production)
      if (req.headers["x-disable-auth"] === "true") {
        console.log("⚠️ Authorization bypassed for this request");
        return next();
      }

      // ========================================
      // 🔥 INTENTIONAL SUPERUSER BYPASS
      // Users with departmentCode = "All" bypass ALL checks
      // ========================================
      if (userDepartment === "All") {
        console.log(`\n🔓 SUPERUSER ACCESS GRANTED`);
        console.log(`   User: ${user.individualName}`);
        console.log(`   Department: ${userDepartment}`);
        console.log(`   Permission: ${requiredPermission}`);
        console.log(`   ✅ All checks bypassed - Superuser access\n`);

        req.permission = { 
          name: requiredPermission,
          isSuperuserAccess: true 
        };
        req.effectiveScope = {
          department: "All",
          hierarchy: "ORGANIZATION",
          orgUnit: req.userOrgUnit,
          isSuperuser: true
        };

        return next();
      }

      // ========================================
      // REGULAR USER AUTHORIZATION (Non-Superuser)
      // ========================================
      
      // STEP 1: ✅ FIXED - Use dynamic permission aggregation
      const userPermissions = await getPermissionsForUser(user);

      if (!userPermissions.has(requiredPermission)) {
        console.log(`❌ Permission denied: User lacks '${requiredPermission}'`);
        console.log(`   User: ${user.individualName}`);
        console.log(`   Department: ${userDepartment}`);
        console.log(`   Available permissions:`, Array.from(userPermissions));
        
        return res.status(403).json({
          success: false,
          message: `Forbidden: Missing permission '${requiredPermission}'`,
          hint: "Contact your administrator to request this permission"
        });
      }

      // STEP 2: Get permission details from DB
      const permission = await PermissionModel.findOne({
        $or: [
          { name: requiredPermission },
          { action: requiredPermission }
        ],
        isActive: true
      });

      if (!permission) {
        console.error(`⚠️ Permission '${requiredPermission}' not found in database`);
        return res.status(403).json({
          success: false,
          message: "Permission configuration error"
        });
      }

      // STEP 3: Check department scope
      console.log(`\n🔍 Authorization Check for: ${requiredPermission}`);
      console.log(`   User: ${user.individualName}`);
      console.log(`   User Department: ${userDepartment}`);
      console.log(`   Permission Scope: ${permission.statusScope}`);

      if (!permission.appliesToDepartment(userDepartment)) {
        console.log(`❌ Department scope check failed`);
        console.log(`   User department '${userDepartment}' not in scope: ${permission.statusScope}`);
        
        return res.status(403).json({
          success: false,
          message: `Forbidden: This action is not available for ${userDepartment} department`,
          hint: `This permission is only available for: ${permission.statusScope.join(', ')}`
        });
      }

      console.log(`✅ Department scope check passed`);

      // STEP 4: Check hierarchy scope
      const targetEmployeeId = req.params.employeeId || 
                               req.params.finalizedEmployeeId ||
                               req.body.employeeId ||
                               options.targetEmployeeId;

      if (targetEmployeeId && permission.hierarchyScope !== "ORGANIZATION") {
        const targetEmployee = await FinalizedEmployee.findById(targetEmployeeId);
        
        if (!targetEmployee) {
          return res.status(404).json({
            success: false,
            message: "Target employee not found"
          });
        }

        const targetAssignment = await RoleAssignmentModel.findOne({
          employeeId: targetEmployee._id,
          isActive: true
        }).populate('orgUnit');

        if (!targetAssignment) {
          return res.status(400).json({
            success: false,
            message: "Target employee has no active role assignment"
          });
        }

        const targetDepartment = targetAssignment.departmentCode;
        const targetOrgUnit = targetAssignment.orgUnit;

        switch (permission.hierarchyScope) {
          case "SELF":
            if (user._id.toString() !== targetEmployee._id.toString()) {
              return res.status(403).json({
                success: false,
                message: "Forbidden: You can only perform this action on yourself"
              });
            }
            break;

          case "DESCENDANT":
            const isDescendant = await isAncestorOf(
              req.userOrgUnit._id,
              targetOrgUnit._id
            );

            if (!isDescendant) {
              return res.status(403).json({
                success: false,
                message: "Forbidden: Target employee is not in your hierarchy"
              });
            }
            break;

          case "DEPARTMENT":
            if (userDepartment !== targetDepartment) {
              return res.status(403).json({
                success: false,
                message: `Forbidden: Target employee is in ${targetDepartment} department`,
                hint: "You can only perform this action on employees in your department"
              });
            }
            break;

          case "ORGANIZATION":
            // Always allowed
            break;

          default:
            return res.status(403).json({
              success: false,
              message: "Invalid hierarchy scope configuration"
            });
        }
      }

      // STEP 5: Attach metadata and proceed
      req.permission = permission;
      req.effectiveScope = {
        department: userDepartment,
        hierarchy: permission.hierarchyScope,
        orgUnit: req.userOrgUnit
      };

      console.log(`✅ Authorization passed: ${requiredPermission} for ${user.individualName}\n`);
      next();

    } catch (err) {
      console.error("Authorization error:", err);
      res.status(500).json({
        success: false,
        message: "Authorization error",
        error: err.message
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
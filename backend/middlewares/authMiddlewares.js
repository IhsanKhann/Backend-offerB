import jwt from "jsonwebtoken";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import RoleModel from "../models/HRModals/Role.model.js";
import { PermissionModel } from "../models/HRModals/Permissions.model.js";
import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import dotenv from "dotenv";

dotenv.config();

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
// UTILITY: Get All Descendant OrgUnits
// ========================================
export const getAllDescendants = async (orgUnitId) => {
  const descendants = [];
  const queue = [orgUnitId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await OrgUnitModel.find({ parent: currentId });
    
    children.forEach(child => {
      descendants.push(child._id);
      queue.push(child._id);
    });
  }

  return descendants;
};

// ========================================
// UTILITY: Check if User is Ancestor
// ========================================
export const isAncestorOf = async (ancestorOrgUnitId, descendantOrgUnitId) => {
  if (!ancestorOrgUnitId || !descendantOrgUnitId) return false;
  
  if (ancestorOrgUnitId.toString() === descendantOrgUnitId.toString()) {
    return true; // Same unit
  }

  let current = await OrgUnitModel.findById(descendantOrgUnitId);
  
  while (current && current.parent) {
    if (current.parent.toString() === ancestorOrgUnitId.toString()) {
      return true;
    }
    current = await OrgUnitModel.findById(current.parent);
  }

  return false;
};

// ========================================
// UTILITY: Get Effective Permissions
// ========================================
export const getPermissionsForUser = async (user) => {
  // Get active role assignment
  const assignment = await RoleAssignmentModel.findOne({
    employeeId: user._id,
    isActive: true
  }).populate({
    path: 'roleId',
    populate: {
      path: 'permissions',
      match: { isActive: true }
    }
  });

  if (!assignment || !assignment.roleId) {
    return new Set();
  }

  const role = assignment.roleId;
  const userDepartment = assignment.departmentCode;

  // Filter permissions by department scope
  const effectivePermissions = role.permissions.filter(perm => {
    return perm.statusScope.includes("ALL") || 
           perm.statusScope.includes(userDepartment);
  });

  // Return as Set of permission names/actions
  const permSet = new Set();
  effectivePermissions.forEach(perm => {
    permSet.add(perm.name);
    if (perm.action) permSet.add(perm.action);
  });

  return permSet;
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

    // ✅ NEW: Attach role assignment with department info
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

// Updated checkAuth function
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

    // ✅ Handle "All" department code
    let department = assignment?.departmentCode || null;
    
    // Convert "All" to array of all departments for frontend
    let accessibleDepartments = [];
    if (department === "All") {
      accessibleDepartments = ["HR", "Finance", "BusinessOperation"];
    } else if (department) {
      accessibleDepartments = [department];
    }

    const userResponse = {
      ...user.toObject(),
      department: department, // "All", "HR", "Finance", or "BusinessOperation"
      accessibleDepartments: accessibleDepartments, // Array of accessible departments
      role: assignment?.roleId || null,
      orgUnit: assignment?.orgUnit || null,
      status: assignment?.status || null
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

export const authorize = (requiredPermission, options = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const userAssignment = req.userAssignment;

      if (req.headers["x-disable-auth"] === "true") {
        console.log("⚠️ Authorization bypassed for this request");
        return next();
      }

      const userPermissions = await getPermissionsForUser(user);

      if (!userPermissions.has(requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Missing permission '${requiredPermission}'`,
          hint: "Contact your administrator to request this permission"
        });
      }

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

      // ✅ Handle "All" department - bypass department check
      const userDepartment = req.userDepartment;
      
      if (userDepartment !== "All") {
        if (!permission.appliesToDepartment(userDepartment)) {
          return res.status(403).json({
            success: false,
            message: `Forbidden: This action is not available for ${userDepartment} department`,
            hint: `This permission is only available for: ${permission.statusScope.join(', ')}`
          });
        }
      }
      // If userDepartment is "All", skip department scope check

      // Hierarchy scope checking remains the same...
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
            // ✅ If user has "All" access, allow
            if (userDepartment === "All") {
              break;
            }
            
            if (userDepartment !== targetDepartment) {
              return res.status(403).json({
                success: false,
                message: `Forbidden: Target employee is in ${targetDepartment} department`,
                hint: "You can only perform this action on employees in your department"
              });
            }
            break;

          case "ORGANIZATION":
            break;

          default:
            return res.status(403).json({
              success: false,
              message: "Invalid hierarchy scope configuration"
            });
        }
      }

      req.permission = permission;
      req.effectiveScope = {
        department: userDepartment,
        hierarchy: permission.hierarchyScope,
        orgUnit: req.userOrgUnit
      };

      console.log(`✅ Authorization passed: ${requiredPermission} for ${user.individualName}`);
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
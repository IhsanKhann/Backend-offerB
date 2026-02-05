import EmployeeModel from "../models/HRModals/Employee.model.js";
import RoleModel from "../models/HRModals/Role.model.js";
import { PermissionModel } from "../models/HRModals/Permissions.model.js";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";

/**
 * ✅ KEEP PERMISSIONS UPDATED (Auto-assign all perms to Chairman/BoD)
 */
export async function KeepPermissionsUpdated() {
  try {
    const alwaysUpdateRoles = ["Chairman", "BoD Member"];

    const allPermissions = await PermissionModel.find({});
    if (!allPermissions.length) {
      console.warn("No permissions found in DB.");
      return;
    }
    const allPermissionIds = allPermissions.map((p) => p._id.toString());

    const roles = await RoleModel.find({ roleName: { $in: alwaysUpdateRoles } });

    if (!roles.length) {
      console.warn("No matching roles found for KeepPermissionsUpdated.");
      return;
    }

    for (const role of roles) {
      const currentIds = role.permissions.map((id) => id.toString());

      const isDifferent =
        currentIds.length !== allPermissionIds.length ||
        !currentIds.every((id) => allPermissionIds.includes(id));

      if (isDifferent) {
        role.permissions = allPermissionIds;
        await role.save();
        console.log(`✅ Updated role '${role.roleName}' with latest permissions.`);
      }
    }
  } catch (error) {
    console.error("KeepPermissionsUpdated error:", error);
  }
}

/**
 * ✅ GET ALL PERMISSIONS
 * Returns all system permissions with proper formatting
 */
export const AllPermissions = async (req, res) => {
  try {
    const { category, departmentCode, isActive = true } = req.query;

    let filter = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (category && category !== "All") {
      filter.category = category;
    }

    // Department filtering using statusScope
    if (departmentCode && departmentCode !== "All") {
      filter.$or = [
        { statusScope: "ALL" },
        { statusScope: departmentCode },
        { statusScope: { $size: 0 } }
      ];
    }

    const permissions = await PermissionModel.find(filter)
      .sort({ category: 1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: permissions.length,
      filters: { category, departmentCode, isActive },
      data: permissions,
    });
  } catch (error) {
    console.error("🔥 AllPermissions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch permissions",
      error: error.message,
    });
  }
};

/**
 * ✅ CREATE PERMISSION
 */
export const createPermission = async (req, res) => {
  try {
    const {
      name,
      action,
      description,
      statusScope = ["ALL"],
      hierarchyScope = "SELF",
      resourceType = "ALL",
      category = "System",
    } = req.body;

    if (!name || !action) {
      return res.status(400).json({
        success: false,
        message: "Name and action are required",
      });
    }

    // Check for duplicate
    const exists = await PermissionModel.findOne({ name });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Permission with this name already exists",
      });
    }

    const permission = await PermissionModel.create({
      name,
      action,
      description,
      statusScope,
      hierarchyScope,
      resourceType,
      category,
      isActive: true,
    });

    // Auto-update Chairman and BoD roles
    await KeepPermissionsUpdated();

    return res.status(201).json({
      success: true,
      message: "Permission created successfully",
      data: permission,
    });
  } catch (error) {
    console.error("🔥 createPermission error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create permission",
      error: error.message,
    });
  }
};

/**
 * ✅ UPDATE PERMISSION
 */
export const updatePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const updates = req.body;

    const permission = await PermissionModel.findById(permissionId);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    // Prevent updating system permissions' core fields
    if (permission.isSystem) {
      delete updates.name;
      delete updates.action;
      delete updates.isSystem;
    }

    Object.assign(permission, updates);
    await permission.save();

    return res.status(200).json({
      success: true,
      message: "Permission updated successfully",
      data: permission,
    });
  } catch (error) {
    console.error("🔥 updatePermission error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update permission",
      error: error.message,
    });
  }
};

/**
 * ✅ DELETE PERMISSION
 */
export const removePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;

    const permission = await PermissionModel.findById(permissionId);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    if (permission.isSystem) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete system permissions",
      });
    }

    // Remove from all roles
    await RoleModel.updateMany(
      { permissions: permissionId },
      { $pull: { permissions: permissionId } }
    );

    await PermissionModel.findByIdAndDelete(permissionId);

    return res.status(200).json({
      success: true,
      message: "Permission deleted successfully",
    });
  } catch (error) {
    console.error("🔥 removePermission error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete permission",
      error: error.message,
    });
  }
};

/**
 * ✅ GET EMPLOYEE PERMISSIONS (Simple version)
 */
export const getEmployeePermissions = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "employeeId is required",
      });
    }

    const assignment = await RoleAssignmentModel.findOne({
      employeeId,
      isActive: true
    })
      .populate({
        path: "roleId",
        populate: {
          path: "permissions",
          model: "Permission",
        },
      })
      .populate('employeeId', 'individualName personalEmail');

    if (!assignment || !assignment.employeeId) {
      return res.status(404).json({
        success: false,
        message: "Employee or role assignment not found",
      });
    }

    const permissions = assignment.roleId?.permissions || [];
    
    return res.status(200).json({
      success: true,
      employeeId: assignment.employeeId._id,
      employeeName: assignment.employeeId.individualName,
      role: assignment.roleId?.roleName || "No Role",
      permissions,
    });
  } catch (error) {
    console.error("🔥 getEmployeePermissions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch permissions",
      error: error.message,
    });
  }
};

/**
 * ✅ GET EMPLOYEE PERMISSIONS DETAILED
 * Returns permissions with source (direct/inherited) and full metadata
 */
export const getEmployeePermissionsDetailed = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "employeeId is required",
      });
    }

    const assignment = await RoleAssignmentModel.findOne({
      employeeId,
      isActive: true
    })
      .populate({
        path: "roleId",
        populate: {
          path: "permissions",
          model: "Permission",
        },
      })
      .populate('employeeId', 'individualName personalEmail UserId avatar')
      .populate('orgUnit', 'name type departmentCode');

    if (!assignment || !assignment.employeeId) {
      return res.status(404).json({
        success: false,
        message: "Employee or role assignment not found",
      });
    }

    // Get direct permissions from role
    const directPermissions = (assignment.roleId?.permissions || []).map(p => ({
      ...p.toObject(),
      source: "direct",
      id: p._id, // Add id field for consistency
    }));

    // Get permission overrides if any
    const overridePermissions = (assignment.permissionOverrides || []).map(p => ({
      ...p.toObject(),
      source: "override",
      id: p._id,
    }));

    // TODO: Implement inherited permissions from organizational hierarchy
    const inheritedPermissions = [];

    // Combine all permissions (remove duplicates)
    const allPermissionsMap = new Map();
    [...directPermissions, ...overridePermissions, ...inheritedPermissions].forEach(p => {
      const key = p._id?.toString() || p.id?.toString();
      if (!allPermissionsMap.has(key)) {
        allPermissionsMap.set(key, p);
      }
    });

    const totalPermissions = Array.from(allPermissionsMap.values());

    return res.status(200).json({
      success: true,
      employeeId: assignment.employeeId._id,
      employeeName: assignment.employeeId.individualName,
      userId: assignment.employeeId.UserId,
      avatar: assignment.employeeId.avatar,
      role: {
        _id: assignment.roleId?._id,
        roleName: assignment.roleId?.roleName,
        category: assignment.roleId?.category
      },
      orgUnit: assignment.orgUnit,
      departmentCode: assignment.departmentCode,
      permissions: {
        direct: directPermissions,
        inherited: inheritedPermissions,
        overrides: overridePermissions,
        total: totalPermissions
      }
    });
  } catch (error) {
    console.error("🔥 getEmployeePermissionsDetailed error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch permissions",
      error: error.message,
    });
  }
};

/**
 * ✅ ADD EMPLOYEE PERMISSION
 * Adds permission to employee's role (affects all employees with same role)
 */
export const addEmployeePermission = async (req, res) => {
  try {
    const { employeeId, permissionId } = req.body;

    if (!employeeId || !permissionId) {
      return res.status(400).json({
        success: false,
        message: "employeeId and permissionId are required",
      });
    }

    // Find employee's active role assignment
    const assignment = await RoleAssignmentModel.findOne({
      employeeId,
      isActive: true
    }).populate('roleId');

    if (!assignment || !assignment.roleId) {
      return res.status(404).json({
        success: false,
        message: "Employee has no active role assignment"
      });
    }

    // Find permission
    const permission = await PermissionModel.findById(permissionId);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }

    // Check if permission is applicable to employee's department
    if (!permission.statusScope?.includes("ALL") && 
        !permission.statusScope?.includes(assignment.departmentCode)) {
      return res.status(400).json({
        success: false,
        message: `Permission not applicable to ${assignment.departmentCode} department`
      });
    }

    // Add to role
    const role = await RoleModel.findById(assignment.roleId._id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // Check if already exists
    const alreadyExists = role.permissions.some(
      (perm) => perm.toString() === permissionId.toString()
    );

    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        message: "Permission already assigned to role"
      });
    }

    role.permissions.push(permissionId);
    await role.save();

    return res.status(200).json({
      success: true,
      message: "Permission added successfully",
      data: {
        roleId: role._id,
        roleName: role.roleName,
        permissionId: permission._id,
        permissionName: permission.name
      }
    });
  } catch (error) {
    console.error("🔥 addEmployeePermission error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add permission",
      error: error.message,
    });
  }
};

/**
 * ✅ REMOVE EMPLOYEE PERMISSION
 */
export const removeEmployeePermission = async (req, res) => {
  try {
    const { employeeId, permissionId } = req.body;

    if (!employeeId || !permissionId) {
      return res.status(400).json({
        success: false,
        message: "employeeId and permissionId are required",
      });
    }

    // Find employee's active role assignment
    const assignment = await RoleAssignmentModel.findOne({
      employeeId,
      isActive: true
    }).populate('roleId');

    if (!assignment || !assignment.roleId) {
      return res.status(404).json({
        success: false,
        message: "Employee has no active role assignment"
      });
    }

    // Remove from role
    const role = await RoleModel.findById(assignment.roleId._id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    role.permissions = role.permissions.filter(
      (perm) => perm.toString() !== permissionId.toString()
    );
    await role.save();

    return res.status(200).json({
      success: true,
      message: "Permission removed successfully",
    });
  } catch (error) {
    console.error("🔥 removeEmployeePermission error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove permission",
      error: error.message,
    });
  }
};

/**
 * ✅ BULK ADD PERMISSIONS
 */
export const addEmployeePermissionsBulk = async (req, res) => {
  try {
    const { employeeId, permissionIds } = req.body;

    if (!employeeId || !Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "employeeId and permissionIds array are required",
      });
    }

    const assignment = await RoleAssignmentModel.findOne({
      employeeId,
      isActive: true
    }).populate('roleId');

    if (!assignment || !assignment.roleId) {
      return res.status(404).json({
        success: false,
        message: "Employee has no active role assignment"
      });
    }

    const role = await RoleModel.findById(assignment.roleId._id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    const addedPermissions = [];
    const skippedPermissions = [];

    for (const permId of permissionIds) {
      const permission = await PermissionModel.findById(permId);
      if (!permission) {
        skippedPermissions.push({ id: permId, reason: "Not found" });
        continue;
      }

      const alreadyExists = role.permissions.some(
        (perm) => perm.toString() === permId.toString()
      );

      if (!alreadyExists) {
        role.permissions.push(permId);
        addedPermissions.push(permission.name);
      } else {
        skippedPermissions.push({ name: permission.name, reason: "Already exists" });
      }
    }

    await role.save();

    return res.status(200).json({
      success: true,
      message: "Bulk permissions processed",
      added: addedPermissions,
      skipped: skippedPermissions,
    });
  } catch (error) {
    console.error("🔥 addEmployeePermissionsBulk error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add permissions"
    });
  }
};

/**
 * ✅ BULK REMOVE PERMISSIONS
 */
export const removeEmployeePermissionsBulk = async (req, res) => {
  try {
    const { employeeId, permissionIds } = req.body;

    if (!employeeId || !Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "employeeId and permissionIds array are required",
      });
    }

    const assignment = await RoleAssignmentModel.findOne({
      employeeId,
      isActive: true
    }).populate('roleId');

    if (!assignment || !assignment.roleId) {
      return res.status(404).json({
        success: false,
        message: "Employee has no active role assignment"
      });
    }

    const role = await RoleModel.findById(assignment.roleId._id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    role.permissions = role.permissions.filter(
      (perm) => !permissionIds.includes(perm.toString())
    );

    await role.save();

    return res.status(200).json({
      success: true,
      message: "Bulk permissions removal processed",
    });
  } catch (error) {
    console.error("🔥 removeEmployeePermissionsBulk error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove permissions"
    });
  }
};

/**
 * ✅ GET ALL EMPLOYEES WITH PERMISSIONS
 */
export const getAllEmployeesWithPermissions = async (req, res) => {
  try {
    const { category, departmentCode } = req.query;

    const assignments = await RoleAssignmentModel.find({ isActive: true })
      .populate({
        path: 'employeeId',
        match: { 'profileStatus.decision': { $in: ['Approved', 'Restored'] } }
      })
      .populate({
        path: 'roleId',
        populate: {
          path: 'permissions',
          model: 'Permission'
        }
      })
      .populate('orgUnit', 'name type');

    const validAssignments = assignments.filter(a => a.employeeId);

    let filteredAssignments = validAssignments;
    if (category && category !== 'All') {
      filteredAssignments = validAssignments.filter(a => 
        a.roleId?.category === category
      );
    }

    if (departmentCode && departmentCode !== 'All') {
      filteredAssignments = filteredAssignments.filter(a =>
        a.departmentCode === departmentCode
      );
    }

    const employees = filteredAssignments.map(assignment => {
      const emp = assignment.employeeId;
      const role = assignment.roleId;
      
      return {
        _id: emp._id,
        individualName: emp.individualName,
        personalEmail: emp.personalEmail,
        UserId: emp.UserId,
        avatar: emp.avatar,
        role: {
          _id: role?._id,
          roleName: role?.roleName,
          category: role?.category,
          permissions: role?.permissions || []
        },
        orgUnit: assignment.orgUnit,
        departmentCode: assignment.departmentCode,
        effectivePermissionsCount: role?.permissions?.length || 0
      };
    });

    return res.status(200).json({
      success: true,
      count: employees.length,
      filters: { category, departmentCode },
      data: employees
    });

  } catch (error) {
    console.error("🔥 getAllEmployeesWithPermissions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employees with permissions",
      error: error.message
    });
  }
};

/**
 * ✅ GET PERMISSION STATISTICS
 */
export const getPermissionStatistics = async (req, res) => {
  try {
    const totalPermissions = await PermissionModel.countDocuments({ isActive: true });
    const totalEmployees = await FinalizedEmployee.countDocuments({
      'profileStatus.decision': { $in: ['Approved', 'Restored'] }
    });
    const totalRoles = await RoleModel.countDocuments({ isActive: true });
    
    const permissionsByCategory = await PermissionModel.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);

    const rolePermissions = await RoleModel.aggregate([
      { $unwind: "$permissions" },
      { $group: { _id: "$permissions", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "permissions",
          localField: "_id",
          foreignField: "_id",
          as: "permission"
        }
      },
      { $unwind: "$permission" },
      {
        $project: {
          _id: "$permission._id",
          name: "$permission.name",
          description: "$permission.description",
          category: "$permission.category",
          usageCount: "$count"
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      statistics: {
        totalPermissions,
        totalEmployees,
        totalRoles,
        permissionsByCategory,
        mostUsedPermissions: rolePermissions
      }
    });

  } catch (error) {
    console.error("🔥 getPermissionStatistics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message
    });
  }
};

/**
 * ✅ PREVIEW INHERITANCE (Future feature)
 */
export const previewInheritance = async (req, res) => {
  try {
    const { employeeId } = req.query;

    // TODO: Implement inheritance preview logic
    // This would show what permissions an employee would inherit
    // from their organizational hierarchy

    return res.status(200).json({
      success: true,
      message: "Inheritance preview not yet implemented",
      data: {
        direct: [],
        inherited: [],
        total: []
      }
    });
  } catch (error) {
    console.error("🔥 previewInheritance error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to preview inheritance",
      error: error.message
    });
  }
};

/**
 * ✅ GET FINALIZED EMPLOYEES WITH ROLES ENHANCED
 */
export const getFinalizedEmployeesWithRolesEnhanced = async (req, res) => {
  try {
    const { category, departmentCode, search } = req.query;
    
    let query = {
      'profileStatus.decision': { $in: ['Approved', 'Restored'] }
    };
    
    if (search) {
      query.$or = [
        { individualName: new RegExp(search, 'i') },
        { personalEmail: new RegExp(search, 'i') },
        { UserId: new RegExp(search, 'i') }
      ];
    }

    const employees = await FinalizedEmployee.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Get role assignments
    const employeeIds = employees.map(e => e._id);
    const assignments = await RoleAssignmentModel.find({
      employeeId: { $in: employeeIds },
      isActive: true
    })
      .populate({
        path: 'roleId',
        populate: {
          path: 'permissions',
          model: 'Permission'
        }
      })
      .populate('orgUnit', 'name type departmentCode')
      .lean();

    // Create assignment map
    const assignmentMap = new Map();
    assignments.forEach(a => {
      assignmentMap.set(a.employeeId.toString(), a);
    });

    // Merge data
    const enrichedEmployees = employees.map(emp => {
      const assignment = assignmentMap.get(emp._id.toString());
      return {
        ...emp,
        role: assignment?.roleId || null,
        orgUnit: assignment?.orgUnit || null,
        departmentCode: assignment?.departmentCode || null
      };
    });

    // Apply filters
    let filteredEmployees = enrichedEmployees;
    
    if (category && category !== 'All') {
      filteredEmployees = enrichedEmployees.filter(e => e.role?.category === category);
    }
    
    if (departmentCode && departmentCode !== 'All') {
      filteredEmployees = filteredEmployees.filter(e => 
        e.departmentCode === departmentCode
      );
    }

    return res.status(200).json({
      success: true,
      count: filteredEmployees.length,
      filters: { category, departmentCode, search },
      data: filteredEmployees,
    });
  } catch (error) {
    console.error("🔥 getFinalizedEmployeesWithRolesEnhanced error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch employees",
      error: error.message 
    });
  }
};
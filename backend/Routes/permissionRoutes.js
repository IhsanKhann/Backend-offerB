import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import { checkHierarchy } from "../middlewares/hierarchyGuard.js";
import {
    getEmployeePermissions,
    AllPermissions,
    createPermission,
    removePermission,
    removeEmployeePermission,
    addEmployeePermission,
    updatePermission,
    addEmployeePermissionsBulk,
    removeEmployeePermissionsBulk,
    previewInheritance,

    getPermissionStatistics,
    getEmployeePermissionsDetailed,
    getAllEmployeesWithPermissions,
    getFinalizedEmployeesWithRolesEnhanced,
} from "../contollers/permissionControllers.js";

const router = express.Router();
router.use(authenticate);

// ========================================
// SYSTEM-LEVEL PERMISSION MANAGEMENT
// (No hierarchy checks needed - operates on permission templates)
// ========================================

router.get("/preview-inheritance", authorize("view_Permissions"), previewInheritance);

// View all permissions (system-level)
router.get(
  "/AllPermissions",
  authorize("view_Permissions"),
  AllPermissions
);

// Create/add a new permission (system-level)
router.post(
  "/createPermission",
  authorize("add_Permissions"),
  createPermission
);

// Update a permission (system-level)
router.put(
  "/updatePermission/:permissionId",
  authorize("update_Permissions"),
  updatePermission
);

// Remove a permission (system-level)
router.delete(
  "/removePermission/:permissionId",
  authorize("delete_Permissions"),
  removePermission
);


// Get all employees with permissions
router.get(
  "/employees-with-permissions",
  authorize("view_Permissions"),
  getAllEmployeesWithPermissions
);

// Get permission statistics
router.get(
  "/statistics",
  authorize("view_Permissions"),
  getPermissionStatistics
);

router.get(
  "/finalized-employees-with-roles-enhanced",
  authorize("view_Permissions"),
  getFinalizedEmployeesWithRolesEnhanced
);

// ========================================
// EMPLOYEE-SPECIFIC PERMISSION MANAGEMENT
// ✅ FIXED: Added hierarchy guards to protect operations
// ========================================

router.get(
  "/getPermissions/:employeeId",
  checkHierarchy(), 
  authorize("view_employee_permissions"),
  getEmployeePermissions
);

router.post(
  "/addPermissionsInBulk",
  checkHierarchy(), 
  authorize("add_permission_in_bulk"),
  addEmployeePermissionsBulk
);

router.delete(
  "/removePermissionsInBulk",
  checkHierarchy(), 
  authorize("remove_permission_in_bulk"),
  removeEmployeePermissionsBulk
);

router.post(
  "/addEmployeePermission",
  checkHierarchy(), 
  authorize("assign_permission_to_employee"),
  addEmployeePermission
);

router.post(
  "/removeEmployeePermission",
  checkHierarchy(), 
  authorize("remove_permission_from_employee"),
  removeEmployeePermission
);

router.get(
  "/getPermissionsDetailed/:employeeId",
  checkHierarchy(),
  authorize("view_employee_permissions"),
  getEmployeePermissionsDetailed
);

export default router;
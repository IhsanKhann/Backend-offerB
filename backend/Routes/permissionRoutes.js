// File: routes/permissionRoutes.js
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

// ============================================
// SYSTEM-LEVEL PERMISSION MANAGEMENT
// ============================================

/**
 * ✅ NEW ROUTE: Preview permission inheritance
 * Used by frontend AssignRolesForm
 * Route: GET /permissions/preview-inheritance?roleId=X&orgUnitId=Y
 */
router.get(
  "/preview-inheritance",
  previewInheritance
);

router.get(
  "/AllPermissions",
  authorize("view_Permissions"),
  AllPermissions
);

router.post(
  "/createPermission",
  authorize("add_Permissions"),
  createPermission
);

router.put(
  "/updatePermission/:permissionId",
  authorize("update_Permissions"),
  updatePermission
);

router.delete(
  "/removePermission/:permissionId",
  authorize("delete_Permissions"),
  removePermission
);

router.get(
  "/employees-with-permissions",
  authorize("view_Permissions"),
  getAllEmployeesWithPermissions
);

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

// ============================================
// EMPLOYEE-SPECIFIC PERMISSION MANAGEMENT
// ============================================

router.get(
  "/getPermissions/:employeeId",
  checkHierarchy(), 
  authorize("view_employee_permissions"),
  getEmployeePermissions
);

router.get(
  "/getPermissionsDetailed/:employeeId",
  checkHierarchy(),
  authorize("view_employee_permissions"),
  getEmployeePermissionsDetailed
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

export default router;
import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import { setResourceOrgUnit } from "../middlewares/authUtility.js";
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

} from "../contollers/permissionControllers.js";

const router = express.Router();
router.use(authenticate);

router.post("/addPermissionsInBulk",
  authorize("add_permission_in_bulk"),
  addEmployeePermissionsBulk
);

router.delete("/removePermissionsInBulk",
  authorize("remove_permission_in_bulk"),
  removeEmployeePermissionsBulk
);

// Add permission to employee
router.post(
  "/addEmployeePermission",
  authorize("assign_permission_to_employee"),
  addEmployeePermission
);

// Remove a permission from an employee
router.post(
  "/removeEmployeePermission",
  authorize("remove_permission_from_employee"),
  removeEmployeePermission
);

// Get a specific employee's permissions
router.get(
  "/getPermissions/:employeeId",
  authorize("view_employee_permissions"),
  getEmployeePermissions
);

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

// Remove a permission (system-level)
router.delete(
  "/removePermission/:permissionId",
  authorize("delete_Permissions"),
  removePermission
);

// Update a permission (system-level)
router.put(
  "/updatePermission/:permissionId",
  authorize("update_Permissions"),
  updatePermission
);


export default router;

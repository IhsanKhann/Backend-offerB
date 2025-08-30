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
} from "../contollers/permissionControllers.js";

const router = express.Router();

router.use(authenticate);

// Add permission to employee
router.post(
  "/addEmployeePermission",
  setResourceOrgUnit,
  authorize("assign_permission_to_employee"),
  addEmployeePermission
);

// Remove a permission from an employee
router.post(
  "/removeEmployeePermission",
  setResourceOrgUnit,
  authorize("remove_permission_from_employee"),
  removeEmployeePermission
);

// Get a specific employee's permissions
router.get(
  "/getPermissions/:employeeId",
  setResourceOrgUnit,
  authorize("view_employee_permissions"),
  getEmployeePermissions
);

// View all permissions (system-level)
router.get(
  "/AllPermissions",
  setResourceOrgUnit,
  authorize("view_Permissions"),
  AllPermissions
);

// Create/add a new permission (system-level)
router.post(
  "/createPermission",
  setResourceOrgUnit,
  authorize("create_permission"),
  createPermission
);

// Remove a permission (system-level)
router.delete(
  "/removePermission/:id",
  setResourceOrgUnit,
  authorize("delete_permission"),
  removePermission
);

// Update a permission (system-level)
router.put(
  "/updatePermission/:id",
  setResourceOrgUnit,
  authorize("update_permission"),
  updatePermission
);

export default router;

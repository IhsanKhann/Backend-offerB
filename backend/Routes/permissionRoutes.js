import express from "express";
import {
    getEmployeePermissions,
    AllPermissions,
    createPermission,
    removePermission,
    removeEmployeePermission,
    addEmployeePermission,
    updatePermission,
} from "../contollers/permissionControllers.js";
import {authenticate,authorize} from "../middlewares/authMiddlewares.js";

const router = express.Router()
router.use(authenticate);

router.post(
  "/permissions/addEmployeePermission",
  authorize("assign_permission_to_employee"),
  addEmployeePermission
);

// remove a permission from an employee..
router.post(
  "/permissions/removeEmployeePermission",
  authorize("remove_permission_from_employee"),
  removeEmployeePermission
);

// get a specific employee's permissions..
router.get(
  "/permissions/getPermissions/:employeeId",
  authorize("view_employee_permissions"),
  getEmployeePermissions
);

// view all permissions..
router.get(
  "/permissions/AllPermissions",
  authorize("view_permissions"),  // new one
  AllPermissions
);

// create/add a new permission..
router.post(
  "/permissions/createPermission",
  authorize("create_permission"),  // new one
  createPermission
);

// remove a permission (system-level)..
router.delete(
  "/permissions/removePermission/:id",
  authorize("delete_permission"), // new one
  removePermission
);

router.put("/permissions/updatePermission/:id", updatePermission);
export default router;
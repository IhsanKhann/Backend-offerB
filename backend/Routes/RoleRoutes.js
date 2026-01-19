import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import {
  getAllRolesList,
  getRoleById,
  addRole,
  updateRole,
  deleteRole,
  getEmployeeRoleAssignment,
  getRolesByDepartment,
} from "../contollers/RoleController.js";

import {AssignEmployeePost} from "../contollers/employeeController.js";

const router = express.Router();

router.use(authenticate);

// Get all role declarations
router.get(
  "/roles",
//   authorize("View_Roles"),
  getAllRolesList
);

// Get role by ID
router.get(
  "/roles/:roleId",
//   authorize("View_Roles"),
  getRoleById
);

// Get roles by department
router.get(
  "/roles/department/:code",
//   authorize("View_Roles"),
  getRolesByDepartment
);

// Add new role declaration
router.post(
  "/roles",
//   authorize("Add_Role"),
  addRole
);

// Update role declaration
router.put(
  "/roles/:roleId",
//   authorize("Edit_Role"),
  updateRole
);

// Delete role declaration
router.delete(
  "/roles/:roleId",
//   authorize("Delete_Role"),
  deleteRole
);

// Assign role to employee (creates role assignment)
router.post(
  "/roles/assign",
//   authorize("Assign_Role"),
  AssignEmployeePost
);

// Get employee's active role assignment
router.get(
  "/roles/assignment/:employeeId",
//   authorize("View_Role_Assignments"),
  getEmployeeRoleAssignment
);
export default router;
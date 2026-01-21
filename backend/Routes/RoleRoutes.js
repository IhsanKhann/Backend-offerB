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

  getRoleAssignmentsGroupedByRole,  
  getEmployeesByRole,               
  getAssignmentsByDepartment,       
} from "../contollers/RoleController.js";

import { AssignEmployeePost } from "../contollers/employeeController.js";

const router = express.Router();

router.use(authenticate);

// ============================================
// ROLE DECLARATIONS (Global)
// ============================================

// Get all role declarations
router.get(
  "/getAllRolesList",
  // authorize("View_Roles"),
  getAllRolesList
);

// Get role by ID
router.get(
  "/:roleId",
  // authorize("View_Roles"),
  getRoleById
);

// Get roles by department (with usage metadata)
router.get(
  "/department/:code",
  // authorize("View_Roles"),
  getRolesByDepartment
);

// Add new role declaration
router.post(
  "/addRole",
  // authorize("Add_Role"),
  addRole
);

// Update role declaration
router.put(
  "/:roleId",
  // authorize("Edit_Role"),
  updateRole
);

// Delete role declaration
router.delete(
  "/deleteRole/:roleId",
  // authorize("Delete_Role"),
  deleteRole
);

// ============================================
// ROLE ASSIGNMENTS (Contextual)
// ============================================

// Assign role to employee (creates role assignment)
router.post(
  "/assign",
  // authorize("Assign_Role"),
  AssignEmployeePost
);

// Get employee's active role assignment
router.get(
  "/assignment/:employeeId",
  // authorize("View_Role_Assignments"),
  getEmployeeRoleAssignment
);

// ✅ NEW: Get role assignments grouped by role (for Grouped view)
router.get(
  "/assignments/grouped",
  // authorize("View_Role_Assignments"),
  getRoleAssignmentsGroupedByRole
);

// ✅ NEW: Get employees by role (shows who has a specific role)
router.get(
  "/assignments/employees/:roleId",
  // authorize("View_Role_Assignments"),
  getEmployeesByRole
);

// ✅ NEW: Get assignments by department
router.get(
  "/assignments/department/:code",
  // authorize("View_Role_Assignments"),
  getAssignmentsByDepartment
);

export default router;
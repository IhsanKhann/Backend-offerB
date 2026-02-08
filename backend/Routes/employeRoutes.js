// routes/employeeRoutes.js

import express from "express";
import upload from "../middlewares/mutlerMiddleware.js";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import { checkDepartment } from "../middlewares/departmentGuard.js";
import { checkHierarchy } from "../middlewares/hierarchyGuard.js";

import {
  RegisterEmployee,
  SubmitEmployee,
  EditEmployee,
  deleteEmployee,
  getSingleEmployee,
  getAllEmployees,
  AssignEmployeePost,
  getAllRoles,
  getSingleRole,
} from "../contollers/employeeController.js";

const router = express.Router();

// ============================================
// AUTHENTICATION REQUIRED FOR ALL ROUTES
// ============================================
router.use(authenticate);

// ============================================
// ROLE MANAGEMENT
// ============================================

// View all roles (system-level, no hierarchy check needed)
router.get(
  "/getAllRoles",
  authorize("view_all_roles", { resourceType: 'ROLE' }),
  getAllRoles
);

// View single role by ID
router.get(
  "/roles/:id",
  authorize("view_single_role", { resourceType: 'ROLE' }),
  getSingleRole
);

// ============================================
// EMPLOYEE REGISTRATION & MANAGEMENT
// ============================================

// Register new employee
// ✅ RBAC: Requires register_employee permission
// ✅ Hierarchy: Automatically validated in controller
// ✅ Department: Must be in same department or executive
router.post(
  "/register",
  checkDepartment(),
  authorize("register_employee", { resourceType: 'EMPLOYEE' }),
  upload.single("profileImage"),
  RegisterEmployee
);

// Edit draft employee (before submission)
// ✅ RBAC: Checks hierarchyScope DESCENDANT
// ✅ Hierarchy: Can only edit subordinates
router.put(
  "/edit/:employeeId",
  authorize("edit_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  upload.single("profileImage"),
  EditEmployee
);

// Submit employee for approval
// ✅ RBAC: SELF scope - can submit own draft
router.post(
  "/submit-employee",
  authorize("submit_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  SubmitEmployee
);

// Delete draft employee
// ✅ RBAC: DESCENDANT scope
// ✅ Hierarchy: Can only delete subordinates
router.delete(
  "/deleteEmployee/:employeeId",
  authorize("delete_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  deleteEmployee
);

// ============================================
// EMPLOYEE VIEWING
// ============================================

// View all employees
// ✅ RBAC: ORGANIZATION scope
// ✅ Department: Filtered by department unless executive
router.get(
  "/getAllEmployees",
  checkDepartment(),
  authorize("view_all_employees", { resourceType: 'EMPLOYEE' }),
  getAllEmployees
);

// View single employee
// ✅ RBAC: DESCENDANT scope
// ✅ Hierarchy: Can only view subordinates or self
router.get(
  "/:employeeId",
  authorize("view_single_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  getSingleEmployee
);

// ============================================
// ROLE ASSIGNMENT
// ============================================

// Assign role to employee
// ✅ RBAC: DESCENDANT scope
// ✅ Hierarchy: Can only assign to subordinates
// ✅ Permission validation: Cannot grant permissions actor doesn't have
router.post(
  "/roles/assign",
  authorize("assign_employee_role", { resourceType: 'ROLE' }),
  checkHierarchy(),
  checkDepartment(),
  AssignEmployeePost
);

export default router;``
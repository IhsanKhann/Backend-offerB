import express from "express";
import upload from "../middlewares/mutlerMiddleware.js";
import { authorize, authenticate } from "../middlewares/authMiddlewares.js";
import { setResourceOrgUnit } from "../middlewares/authUtility.js";

import {
  RegisterEmployee,
  SubmitEmployee,
  deleteEmployee,
  getSingleEmployee,
  getAllEmployees,
  AssignEmployeePost,
  getAllRoles,
  getSingleRole,
  resolveOrgUnit,
} from "../contollers/employeeController.js";

const router = express.Router();

// 🔐 Authentication middleware
router.use(authenticate);

// ------------------- Employee Routes -------------------

// Register new employee
router.post(
  "/register",
  setResourceOrgUnit,
  authorize("register_employee"),
  upload.single("profileImage"),
  RegisterEmployee
);

// Submit employee for approval
router.post(
  "/submit-employee",
  setResourceOrgUnit,
  authorize("submit_employee"),
  SubmitEmployee
);

// Delete employee (before finalized)
router.delete(
  "/deleteEmployee/:employeeId",
  setResourceOrgUnit,
  authorize("delete_employee"),
  deleteEmployee
);

// View all employees
router.get(
  "/getAllEmployees",
  setResourceOrgUnit,
  authorize("view_all_employees"),
  getAllEmployees
);

// View single employee
router.get(
  "/:employeeId",
  setResourceOrgUnit,
  authorize("view_single_employee"),
  getSingleEmployee
);

// ------------------- Role Routes -------------------

// Assign employee role
router.post(
  "/roles",
  setResourceOrgUnit,
  authorize("assign_employee_role"),
  AssignEmployeePost
);

// View all roles
router.get(
  "/getAllRoles",
  setResourceOrgUnit,
  authorize("view_all_roles"),
  getAllRoles
);

// View single role
router.get(
  "/roles/:roleId",
  setResourceOrgUnit,
  authorize("view_single_role"),
  getSingleRole
);

// ------------------- Org Unit Routes -------------------

// Resolve Org Unit conflicts
router.post(
  "/org-units/resolve",
  setResourceOrgUnit,
  authorize("resolve_org_unit"),
  resolveOrgUnit
);

export default router;

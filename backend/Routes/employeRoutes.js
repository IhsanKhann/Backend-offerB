import express from "express";
import upload from "../middlewares/mutlerMiddleware.js";
import { authorize, authenticate } from "../middlewares/authMiddlewares.js";
import { setResourceOrgUnit } from "../middlewares/authUtility.js";

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

import { resolveOrgUnit } from "../contollers/employeeController.js";
const router = express.Router();

router.use(authenticate);

// Assign employee role
router.post(
  "/roles/assign",
  authorize("assign_employee_role"),
  AssignEmployeePost
);

// ------------------- Employee Routes -------------------

// View all roles
router.get(
  "/getAllRoles",
  authorize("view_all_roles"),
  getAllRoles
);

// View all employees
router.get(
  "/getAllEmployees",
  authorize("view_all_employees"),
  getAllEmployees
);

// Register new employee
router.post(
  "/register",
  authorize("register_employee"),
  upload.single("profileImage"),
  RegisterEmployee
);

// ✅ NEW: Edit draft employee
router.put(
  "/edit/:employeeId",
  authorize("edit_employee"),
  upload.single("profileImage"),
  EditEmployee
);

// Submit employee for approval
router.post(
  "/submit-employee",
  authorize("submit_employee"),
  SubmitEmployee
);

// Delete employee (before finalized)
router.delete(
  "/deleteEmployee/:employeeId",
  authorize("delete_employee"),
  deleteEmployee
);

// View single employee
router.get(
  "/:employeeId",
  authorize("view_single_employee"),
  getSingleEmployee
);

// ------------------- Role Routes -------------------

// View single role
router.get(
  "/roles/:id",
  authorize("view_single_role"),
  getSingleRole
);

export default router;
import express from "express";
import upload from "../middlewares/mutlerMiddleware.js";
import { authorize, authenticate } from "../middlewares/authMiddlewares.js";

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

// Register new employee
router.post("/register", authorize("register_employee"), upload.single("profileImage"), RegisterEmployee);

// Submit employee for approval
router.post("/submit-employee", authorize("submit_employee"), SubmitEmployee);

// Delete employee (before finalized)
router.delete("/deleteEmployee/:employeeId", authorize("delete_employee"), deleteEmployee);

// View all employees
router.get("/getAllEmployees", authorize("view_all_employees"), getAllEmployees);

// View single employee
router.get("/:employeeId", authorize("view_single_employee"), getSingleEmployee);

// Assign employee role
router.post("/roles", authorize("assign_employee_role"), AssignEmployeePost);

// View all roles
router.get("/getAllRoles", authorize("view_all_roles"), getAllRoles);

// View single role
router.get("/roles/:employeeId", authorize("view_single_role"), getSingleRole);

// Resolve Org Unit conflicts
router.post("/org-units/resolve", authorize("resolve_org_unit"), resolveOrgUnit);

export default router;

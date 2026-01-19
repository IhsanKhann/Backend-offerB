// ============================================
// routes/orgUnitsRoutes.js (UPDATED)
// ============================================
import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import {
  getOrgUnits,
  createOrgUnit,
  updateOrgUnit,
  deleteOrgUnit,
  getEmployeesByOrgUnit,
  getEmployeesByDepartmentAndStatus,
  getOrgUnitsByDepartment,
} from "../contollers/OrgUnitsController.js";

const orgUnitRouter = express.Router();

orgUnitRouter.use(authenticate);

// Get all org units (tree structure)
orgUnitRouter.get(
  "/org-units",
  // authorize("view_org_units"),
  getOrgUnits
);

// Get org units by department
orgUnitRouter.get(
  "/org-units/department/:code",
  // authorize("view_org_units"),
  getOrgUnitsByDepartment
);

// Create org unit
orgUnitRouter.post(
  "/org-units",
  // authorize("create_org_unit"),
  createOrgUnit
);

// Update org unit
orgUnitRouter.put(
  "/org-units/:orgUnitId",
  // authorize("edit_org_unit"),
  updateOrgUnit
);

// Delete org unit
orgUnitRouter.delete(
  "/org-units/:orgUnitId",
  // authorize("delete_org_unit"),
  deleteOrgUnit
);

// Get employees by org unit
orgUnitRouter.get(
  "/org-units/:orgUnitId/employees",
  // authorize("view_employees_by_org_unit"),
  getEmployeesByOrgUnit
);

// Get employees by department and status (for notifications)
orgUnitRouter.get(
  "/org-units/employees/filter",
  // authorize("view_employees_by_org_unit"),
  getEmployeesByDepartmentAndStatus
);

export default orgUnitRouter;
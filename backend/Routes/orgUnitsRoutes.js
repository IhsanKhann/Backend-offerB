// routes/orgUnitsRoutes.js (FIXED)
import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import {
  getOrgUnits,
  getSingleOrgUnit,
  createOrgUnit,
  updateOrgUnit,
  deleteOrgUnit,
  getEmployeesByOrgUnit,
  getOrgUnitsByDepartment,
} from "../contollers/OrgUnitsController.js";

import { resolveOrgUnit } from "../contollers/employeeController.js";

const orgUnitRouter = express.Router();

// ✅ CRITICAL: resolveOrgUnit MUST be BEFORE authenticate middleware
// This route is called during employee registration, before authentication
orgUnitRouter.post("/resolve", resolveOrgUnit);

// ✅ All other routes require authentication
orgUnitRouter.use(authenticate);

// ✅ Get all org units (tree structure)
orgUnitRouter.get("/", getOrgUnits);

// ✅ Get single org unit by ID
orgUnitRouter.get("/:orgUnitId", getSingleOrgUnit);

// Get org units by department
orgUnitRouter.get("/department/:code", getOrgUnitsByDepartment);

// Create org unit
orgUnitRouter.post("/", createOrgUnit);

// Update org unit
orgUnitRouter.put("/:orgUnitId", updateOrgUnit);

// Delete org unit
orgUnitRouter.delete("/:orgUnitId", deleteOrgUnit);

// Get employees by org unit (includes descendants)
orgUnitRouter.get("/:orgUnitId/employees", getEmployeesByOrgUnit);


export default orgUnitRouter;
import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import { resolveOrgUnit } from "../contollers/employeeController.js";

import { 
    getOrgUnits, 
    createOrgUnit,
    getEmployeesByOrgUnit,
} from "../contollers/OrgUnitsController.js";

const router = express.Router();


// Resolve Org Unit conflicts - moved before authentication middleware
router.post(
"/org-units/resolve",
  resolveOrgUnit
);

router.use(authenticate);

// View all org units
router.get(
  "/getOrgUnits",
  authorize("view_org_units"),
  getOrgUnits
);

// Create a new org unit
router.post(
  "/createOrgUnit",
  authorize("create_org_unit"),
  createOrgUnit
);

// View employees by org unit
router.get(
  "/getorgUnit/:orgUnitId",
//   setResourceOrgUnit,
  authorize("view_employees_by_org_unit"),
  getEmployeesByOrgUnit
);

// ------------------- Org Unit Routes -------------------

export default router;

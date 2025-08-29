import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import { 
    getOrgUnits, 
    createOrgUnit,
    getEmployeesByOrgUnit,
} from "../contollers/OrgUnitsController.js";

const router = express.Router();

router.use(authenticate);

// View all org units
router.get("/getOrgUnits", authorize("view_org_units"), getOrgUnits);

// Create a new org unit
router.post("/createOrgUnit", authorize("create_org_unit"), createOrgUnit);

// View employees by org unit
router.get("/getorgUnit/:orgUnitId", authorize("view_employees_by_org_unit"), getEmployeesByOrgUnit);

export default router;

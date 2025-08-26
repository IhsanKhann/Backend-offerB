import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";

import { 
    getOrgUnits, 
    createOrgUnit,
    getEmployeesByOrgUnit,
} from "../contollers/OrgUnitsController.js";

const router = express.Router();

// Apply authentication globally
router.use(authenticate);

// Apply authorization individually per route
router.get("/getOrgUnits", authorize("view_orgunits"), getOrgUnits);

router.post("/createOrgUnit", authorize("create_orgunit"), createOrgUnit);

router.get("/getorgUnit/:orgUnitId", authorize("view_orgunits"), getEmployeesByOrgUnit);

// api/getOrgUnits , api/createOrgUnit
export default router;

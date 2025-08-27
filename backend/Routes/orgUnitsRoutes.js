import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";

import { 
    getOrgUnits, 
    createOrgUnit,
    getEmployeesByOrgUnit,
} from "../contollers/OrgUnitsController.js";

const router = express.Router();


router.use(authenticate);
// Apply authorization individually per route
router.get("/getOrgUnits", getOrgUnits);

router.post("/createOrgUnit", createOrgUnit);

router.get("/getorgUnit/:orgUnitId", getEmployeesByOrgUnit);

export default router;

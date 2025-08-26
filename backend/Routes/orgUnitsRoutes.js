import express from "express";
import { 
    getOrgUnits, 
    createOrgUnit,
    getEmployeesByOrgUnit,
} from "../contollers/OrgUnitsController.js";

const router = express.Router();

router.get("/getOrgUnits", getOrgUnits);
router.post("/createOrgUnit", createOrgUnit);
router.get("/getorgUnit/:orgUnitId", getEmployeesByOrgUnit );

// api/getOrgUnits , api/createOrgUnit
export default router;
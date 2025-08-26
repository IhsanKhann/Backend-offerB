import express from "express";
import { 
    getOrgUnits, 
    createOrgUnit,
    getEmployeesByNode,
} from "../contollers/OrgUnitsController.js";

const router = express.Router();

router.get("/getOrgUnits", getOrgUnits);
router.post("/createOrgUnit", createOrgUnit);
router.get("/getorgUnit/:orgUnitId", getEmployeesByNode );

// api/getOrgUnits , api/createOrgUnit
export default router;
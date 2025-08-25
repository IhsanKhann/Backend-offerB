import express from "express";
import { getOrgUnits, createOrgUnit } from "../contollers/OrgUnitsController.js";

const router = express.Router();

router.get("/getOrgUnits", getOrgUnits);
router.post("/createOrgUnit", createOrgUnit);

// api/getOrgUnits , api/createOrgUnit
export default router;

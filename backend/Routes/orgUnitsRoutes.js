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
  getEmployeesByDepartment,
  moveOrgUnit
} from "../contollers/OrgUnitsController.js";

const orgUnitRouter = express.Router();

// Public route - must be BEFORE authenticate middleware
orgUnitRouter.post("/resolve", async (req, res) => {
  try {
    const { orgUnitName, departmentCode } = req.body;
    
    const { OrgUnitModel } = await import("../models/HRModals/OrgUnit.js");
    
    const orgUnit = await OrgUnitModel.findOne({
      name: new RegExp(`^${orgUnitName}$`, 'i'),
      departmentCode,
      isActive: true
    });

    if (!orgUnit) {
      return res.status(404).json({
        success: false,
        message: "Organization unit not found"
      });
    }

    res.status(200).json({
      success: true,
      orgUnit: {
        _id: orgUnit._id,
        name: orgUnit.name,
        type: orgUnit.type,
        departmentCode: orgUnit.departmentCode,
        path: orgUnit.path
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to resolve org unit",
      error: err.message
    });
  }
});

// All routes below require authentication
orgUnitRouter.use(authenticate);

// ✅ FIXED: Get all org units (tree structure)
// Supports query params: branchId, departmentCode
// Returns: { success: true, data: [...], count: N }
orgUnitRouter.get("/", getOrgUnits);

// Get org units by department
orgUnitRouter.get("/department/:code", getOrgUnitsByDepartment);

// Get employees by department
orgUnitRouter.get("/department/:code/employees", getEmployeesByDepartment);

// ✅ FIXED: Get employees by org unit (includes descendants)
// This is what AdminDashboard.fetchEmployeesByNode calls
// Returns: { success: true, employees: [...] }
orgUnitRouter.get("/:orgUnitId/employees", getEmployeesByOrgUnit);

// Get single org unit by ID
orgUnitRouter.get("/:orgUnitId", getSingleOrgUnit);

// Create org unit
orgUnitRouter.post(
  "/",
  authorize("MANAGE_ORGUNIT"),
  createOrgUnit
);

// Update org unit
orgUnitRouter.put(
  "/:orgUnitId",
  authorize("MANAGE_ORGUNIT"),
  updateOrgUnit
);

// ✅ NEW: Move org unit endpoint for HierarchyTree
orgUnitRouter.patch(
  "/:orgUnitId/move",
  authorize("MANAGE_ORGUNIT"),
  moveOrgUnit
);

// Delete org unit
orgUnitRouter.delete(
  "/:orgUnitId",
  authorize("MANAGE_ORGUNIT"),
  deleteOrgUnit
);

export default orgUnitRouter;
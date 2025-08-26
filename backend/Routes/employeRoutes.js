import express from "express";
import upload from "../middlewares/mutlerMiddleware.js";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";

import {
    RegisterEmployee,
    ApproveEmployee,
    SubmitEmployee,
    RejectEmployee,
    AssignEmployeePost,
    getSingleEmployee,
    getSingleRole,
    getAllEmployees,
    getAllRoles,
    deleteEmployee,
    getSingleFinalizedEmployee,
    getFinalizedEmployees,
    deleteEmployeeAndFinalized,
    resolveOrgUnit,
} from "../contollers/employeeController.js";

const router = express.Router();

// ✅ Global authentication
router.use(authenticate);

// 🔹 Employee Routes
router.get("/employees/allfinalized", authorize("view_profiles"), getFinalizedEmployees);

router.get("/getAllEmployees", authorize("view_profiles"), getAllEmployees);

router.get("/getAllRoles", authorize("view_roles"), getAllRoles);

router.post("/employees/roles", authorize("assign_roles"), AssignEmployeePost);

router.post("/employees/register", authorize("create_employee"), upload.single("profileImage"), RegisterEmployee);

router.post("/submit-employee", authorize("submit_employee"), SubmitEmployee);

router.patch("/employees/approve/:finalizedEmployeeId", authorize("approve_employee"), ApproveEmployee);

router.delete("/employees/reject/:finalizedEmployeeId", authorize("reject_employee"), RejectEmployee);

router.delete("/employees/delete/:finalizedEmployeeId", authorize("delete_finalized_employee"), deleteEmployeeAndFinalized);

router.delete("/deleteEmployee/:employeeId", authorize("delete_employee"), deleteEmployee);

router.get("/employees/getSingleFinalizedEmployee/:finalizedEmployeeId", authorize("view_profiles"), getSingleFinalizedEmployee);
router.get("/roles/:employeeId", authorize("view_roles"), getSingleRole);
router.get("/employees/:employeeId", authorize("view_profiles"), getSingleEmployee);

// 🔹 OrgUnit Route
router.post("/org-units/resolve", authorize("resolve_orgunit"), resolveOrgUnit);

export default router;

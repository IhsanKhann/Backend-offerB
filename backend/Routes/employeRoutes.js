import express from "express";
import upload from "../middlewares/mutlerMiddleware.js";
import { authenticate } from "../middlewares/authMiddlewares.js"; // removed authorize

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
// router.use(authenticate);

// 🔹 Employee Routes
router.get("/employees/allfinalized", getFinalizedEmployees);

router.get("/getAllEmployees", getAllEmployees);

router.get("/getAllRoles", getAllRoles);

router.post("/employees/roles", AssignEmployeePost);

router.post("/employees/register", upload.single("profileImage"), RegisterEmployee);

router.post("/submit-employee", SubmitEmployee);

router.patch("/employees/approve/:finalizedEmployeeId", ApproveEmployee);

router.delete("/employees/reject/:finalizedEmployeeId", RejectEmployee);

router.delete("/employees/delete/:finalizedEmployeeId", deleteEmployeeAndFinalized);

router.delete("/deleteEmployee/:employeeId", deleteEmployee);

router.get("/employees/getSingleFinalizedEmployee/:finalizedEmployeeId", getSingleFinalizedEmployee);
router.get("/roles/:employeeId", getSingleRole);
router.get("/employees/:employeeId", getSingleEmployee);

// 🔹 OrgUnit Route
router.post("/org-units/resolve", resolveOrgUnit);

export default router;

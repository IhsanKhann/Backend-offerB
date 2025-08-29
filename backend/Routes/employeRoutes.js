import express from "express";
import upload from "../middlewares/mutlerMiddleware.js";
import { authorize, authenticate } from "../middlewares/authMiddlewares.js";

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

router.use(authenticate);

// Register new employee
router.post("/employees/register", authorize("register_employee"), upload.single("profileImage"), RegisterEmployee);

// Submit employee for approval
router.post("/submit-employee", authorize("submit_employee"), SubmitEmployee);

// Approve employee
router.patch("/employees/approve/:finalizedEmployeeId", authorize("approve_employee"), ApproveEmployee);

// Reject employee
router.delete("/employees/reject/:finalizedEmployeeId", authorize("reject_employee"), RejectEmployee);

// Delete employee
router.delete("/deleteEmployee/:employeeId", authorize("delete_employee"), deleteEmployee);

// Delete both employee + finalized record
router.delete("/employees/delete/:finalizedEmployeeId", authorize("delete_finalized_employee"), deleteEmployeeAndFinalized);

// View all employees
router.get("/getAllEmployees", authorize("view_all_employees"), getAllEmployees);

// View all finalized employees
router.get("/employees/allfinalized", authorize("view_all_finalized_employees"), getFinalizedEmployees);

// View single employee
router.get("/employees/:employeeId", authorize("view_single_employee"), getSingleEmployee);

// View single finalized employee
router.get("/employees/getSingleFinalizedEmployee/:finalizedEmployeeId", authorize("view_single_finalized_employee"), getSingleFinalizedEmployee);

// Assign employee role
router.post("/employees/roles", authorize("assign_employee_role"), AssignEmployeePost);

// View all roles
router.get("/getAllRoles", authorize("view_all_roles"), getAllRoles);

// View single role
router.get("/roles/:employeeId", authorize("view_single_role"), getSingleRole);

// Resolve Org Unit conflicts
router.post("/org-units/resolve", authorize("resolve_org_unit"), resolveOrgUnit);

export default router;

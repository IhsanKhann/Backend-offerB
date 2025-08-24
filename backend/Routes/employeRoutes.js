import express from "express";
import upload from "../middlewares/mutlerMiddleware.js";
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
    deleteFinalizedEmployee,

    resolveOrgUnit,
    
} from "../contollers/employeeController.js";

const router = express.Router();

// ✅ Static routes first
router.get("/employees/allfinalized", getFinalizedEmployees);
router.get("/getAllEmployees", getAllEmployees);
router.get("/getAllRoles", getAllRoles);
router.post("/employees/roles", AssignEmployeePost);

// Employee creation + submission
router.post("/employees/register", upload.single("profileImage"), RegisterEmployee);
// the file upload syntax added to the cloudinary..

router.post("/employees/submit", SubmitEmployee);

// Approve / Reject finalized employees
router.patch("/employees/approve/:finalizedEmployeeId", ApproveEmployee);
router.delete("/employees/reject/:finalizedEmployeeId", RejectEmployee);

// Delete finalized + draft together
router.delete("/employees/delete/:finalizedEmployeeId", deleteFinalizedEmployee);

// Delete employee (not finalized)
router.delete("/deleteEmployee/:id", deleteEmployee);

// ✅ Specific dynamic before generic
router.get("/employees/getSingleFinalizedEmployee/:finalizedEmployeeId", getSingleFinalizedEmployee);
router.get("/roles/:employeeId", getSingleRole);

// ✅ Generic dynamic route last
router.get("/employees/:employeeId", getSingleEmployee);

// orgUnit resolve routee..
router.post("/org-units/resolve", resolveOrgUnit);

export default router;

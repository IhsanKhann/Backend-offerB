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


} from "../contollers/employeeController.js";

const router = express.Router();

router.delete("/deleteEmployee/:id", deleteEmployee);
router.post("/employees/roles", AssignEmployeePost);
router.get("/employees/:employeeId", getSingleEmployee);
router.get("/roles/:employeeId", getSingleRole);
router.get("/getAllEmployees", getAllEmployees);
router.get("/getAllRoles", getAllRoles);

// add an employee to the database
router.post("/employees/register", upload.single("profileImage"),RegisterEmployee)
// approve it
router.patch("/employees/approve/:finalizedEmployeeId", ApproveEmployee);
// submit employee
router.post("/employees/Submit", SubmitEmployee);
// reject/delete employee
router.delete("/employees/reject/:finalizedEmployeeId", RejectEmployee)


// for the admin dashboard...
router.get("/employees/getFinalizedEmployees", getFinalizedEmployees);
router.get("/employees/getSingleFinalizedEmployee/:finalizedEmployeeId", getSingleFinalizedEmployee);


export default router; 
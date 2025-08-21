import express from "express";
import upload from "../middlewares/mutlerMiddleware.js";
import {
    RegisterEmployee,
    AssignEmployeeRole,
    getSingleEmployee
} from "../contollers/employeeController.js";

const router = express.Router();

// add an employee to the database
router.post("/employees/register",
    upload.single("profileImage"),
    RegisterEmployee)

router.post("/employees/roles", AssignEmployeeRole);
router.get("/employees/:employeeId", getSingleEmployee);

export default router; 
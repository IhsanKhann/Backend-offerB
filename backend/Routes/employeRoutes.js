import express from "express";
import upload from "../middlewares/mutlerMiddleware.js";
import {
    RegisterEmployee,
    AssignEmployeeRole,
} from "../contollers/employeeController.js";

const router = express.Router();

// add an employee to the database
router.post("/employees/register",
    upload.single("profileImage"),
    RegisterEmployee)

router.post("/employees/roles", AssignEmployeeRole);

export default router; 
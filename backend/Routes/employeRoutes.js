import express from "express";
import upload from "../middlewares/mutlerMiddleware.js";
import {
    RegisterEmployee,
    AssignEmployeeRole,
    getSingleEmployee,
    getSingleRole,
    getAllEmployees,
    getAllRoles,
    deleteEmployee,
} from "../contollers/employeeController.js";

const router = express.Router();

// add an employee to the database
router.post("/employees/register",
    upload.single("profileImage"),
    RegisterEmployee)

router.delete("/deleteEmployee/:id", deleteEmployee);
router.post("/employees/roles", AssignEmployeeRole);
router.get("/employees/:employeeId", getSingleEmployee);
router.get("/roles/:employeeId", getSingleRole);
router.get("/getAllEmployees", getAllEmployees);
router.get("/getAllRoles", getAllRoles);

export default router; 
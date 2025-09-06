// routes/leave.routes.js
import { Router } from "express";
import {
  getOnLeaveEmployees,
  acceptLeave,
  rejectLeave,
  applyLeave,
  deleteLeave,
  getSingleEmployeeLeave,
  takeLeaveBack,
} from "../contollers/LeaveController.js";

import { authorize,authenticate } from "../middlewares/authMiddlewares.js"; // your permission middleware
const router = Router();
router.use(authenticate);

// GET all employees currently on leave
router.get("/all", authorize("viewLeaves"), getOnLeaveEmployees);

// POST accept an employee's leave
router.post("/:leaveId/accept", authorize("acceptLeave"), acceptLeave);

// POST reject an employee's leave (requires reason)
router.post("/:leaveId/reject", authorize("rejectLeave"), rejectLeave);

// Apply for leave
router.post("/apply", 
    applyLeave
);

router.delete("/delete/:employeeId", authorize("deleteLeave"), deleteLeave);
router.get("/:employeeId", getSingleEmployeeLeave);
router.post("/:employeeId/takeback", takeLeaveBack);

export default router;

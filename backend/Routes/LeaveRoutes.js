// routes/leave.routes.js
import { Router } from "express";
import {
  getOnLeaveEmployees,
  acceptLeave,
  rejectLeave,
  transferDuringLeave,
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
router.post("/:employeeId/accept", authorize("acceptLeave"), acceptLeave);

// POST reject an employee's leave (requires reason)
router.post("/:employeeId/reject", authorize("rejectLeave"), rejectLeave);

// POST transfer role/permissions during leave from :employeeId -> targetEmployeeId
router.post("/:employeeId/transfer", authorize("transferLeaveRole"), transferDuringLeave);

// Apply for leave
router.post("/apply",
    authorize("applyForLeave"), 
    applyLeave
);

router.delete("/delete/:employeeId", authorize("deleteLeave"), deleteLeave);
router.get("/:employeeId", getSingleEmployeeLeave);
router.post("/:employeeId/takeback", authorize("takeBackLeave"), takeLeaveBack);

export default router;

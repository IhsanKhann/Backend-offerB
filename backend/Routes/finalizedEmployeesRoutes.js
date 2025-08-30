import express from "express";
import { authorize, authenticate } from "../middlewares/authMiddlewares.js";

import {
  ApproveEmployee,
  RejectEmployee,
  deleteEmployeeAndFinalized,
  getSingleFinalizedEmployee,
  getFinalizedEmployees,
} from "../contollers/employeeController.js";

const router = express.Router();

// 🔐 Authentication middleware
router.use(authenticate);

// Approve employee (finalize)
router.patch("/approve/:finalizedEmployeeId", authorize("approve_employee"), ApproveEmployee);

// Reject employee
router.delete("/reject/:finalizedEmployeeId", authorize("reject_employee"), RejectEmployee);

// Delete both employee + finalized record
router.delete("/delete/:finalizedEmployeeId", authorize("delete_finalized_employee"), deleteEmployeeAndFinalized);

// View all finalized employees
router.get("/all", authorize("view_all_finalized_employees"), getFinalizedEmployees);

// View single finalized employee
router.get("/:finalizedEmployeeId", authorize("view_single_finalized_employee"), getSingleFinalizedEmployee);

export default router;

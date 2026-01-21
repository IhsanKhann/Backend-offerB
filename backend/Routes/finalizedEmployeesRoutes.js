import express from "express";
import { authorize, authenticate } from "../middlewares/authMiddlewares.js";
import { setResourceOrgUnit } from "../middlewares/authUtility.js";

import {
  ApproveEmployee,
  RejectEmployee,
  deleteEmployeeAndFinalized,
  getSingleFinalizedEmployee,
  getFinalizedEmployees,
  suspendEmployee,
  restoreSuspendedEmployee,
  blockEmployee,
  restoreBlockedEmployee,
  terminateEmployee,
  restoreTerminatedEmployee,
  getFinalizedEmployeesWithRoles,
  fetchEmployeesByStatus,
} from "../contollers/employeeController.js";

const router = express.Router();

// 🔐 Authentication middleware
router.use(authenticate);

// ------------------- Finalized Employee Routes -------------------

// View all finalized employees
router.get(
  "/all",
  // authorize("view_all_finalized_employees"),
  getFinalizedEmployees
);

// /finalizedEmployees/allWithRoles - route
router.get("/allWithRoles", 
  // authorize("view_all_finalized_employees"),
  getFinalizedEmployeesWithRoles);

router.patch(
  "/approve/:finalizedEmployeeId",
  // setResourceOrgUnit,
  // authorize("approve_employee"),
  ApproveEmployee
);

// Reject employee
router.delete(
  "/reject/:finalizedEmployeeId",
  // setResourceOrgUnit,
  // authorize("reject_employee"),
  RejectEmployee
);

// Delete both employee + finalized record
router.delete(
  "/delete/:finalizedEmployeeId",
  // setResourceOrgUnit,
  // authorize("delete_finalized_employee"),
  deleteEmployeeAndFinalized
);


// View single finalized employee
router.get(
  "/getSingleFinalizedEmployee/:finalizedEmployeeId",
  // setResourceOrgUnit,
  // authorize("view_single_finalized_employee"),
  getSingleFinalizedEmployee
);

router.post("/suspend/:employeeId", 
  // authorize("suspend_employee"),
suspendEmployee);

router.patch("/restore-suspension/:employeeId", 
  // authorize("restore_suspended_employee"),
restoreSuspendedEmployee);


router.post("/block/:employeeId", 
  // authorize("block_employee"),  
blockEmployee);

router.patch("/restore-block/:employeeId", 
  // authorize("restore_blocked_employee"),  
restoreBlockedEmployee);

router.post("/terminate/:employeeId",
  // authorize("terminate_employee"),
  terminateEmployee
);

router.patch("/restore-terminate/:employeeId",
  // authorize("restore_terminate_employee"),
  restoreTerminatedEmployee
);

router.get("/status/:status",
  // authorize("view_all_finalized_employees"),
  fetchEmployeesByStatus
);

export default router;


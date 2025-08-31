import express from "express";
import { authorize, authenticate } from "../middlewares/authMiddlewares.js";
import { setResourceOrgUnit } from "../middlewares/authUtility.js";

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

// ------------------- Finalized Employee Routes -------------------

// View all finalized employees
router.get(
  "/all",
  authorize("view_all_finalized_employees"),
  getFinalizedEmployees
);

router.patch(
  "/approve/:finalizedEmployeeId",
  // setResourceOrgUnit,
  authorize("approve_employee"),
  ApproveEmployee
);

// Reject employee
router.delete(
  "/reject/:finalizedEmployeeId",
  // setResourceOrgUnit,
  authorize("reject_employee"),
  RejectEmployee
);

// Delete both employee + finalized record
router.delete(
  "/delete/:finalizedEmployeeId",
  // setResourceOrgUnit,
  authorize("delete_finalized_employee"),
  deleteEmployeeAndFinalized
);


// View single finalized employee
router.get(
  "/getSingleFinalizedEmployee/:finalizedEmployeeId",
  // setResourceOrgUnit,
  authorize("view_single_finalized_employee"),
  getSingleFinalizedEmployee
);

export default router;

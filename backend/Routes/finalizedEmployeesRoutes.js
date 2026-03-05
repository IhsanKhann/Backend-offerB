// routes/finalizedEmployeesRoutes.js

import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import { checkDepartment } from "../middlewares/departmentGuard.js";
import { checkHierarchy } from "../middlewares/hierarchyGuard.js";

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

// ============================================
// AUTHENTICATION REQUIRED FOR ALL ROUTES
// ============================================
router.use(authenticate);

// ============================================
// EMPLOYEE VIEWING
// ============================================

// View all finalized employees
// ✅ RBAC: ORGANIZATION scope
// ✅ Department: Filtered unless executive
router.get(
  "/all",
  checkDepartment(),
  authorize("view_all_finalized_employees", { resourceType: 'EMPLOYEE' }),
  getFinalizedEmployees
);

// View all finalized employees with roles populated
// ✅ RBAC: ORGANIZATION scope
router.get(
  "/allWithRoles",
  checkDepartment(),
  authorize("view_all_finalized_employees", { resourceType: 'EMPLOYEE' }),
  getFinalizedEmployeesWithRoles
);

// View single finalized employee
// ✅ RBAC: DESCENDANT scope
// ✅ Hierarchy: Can only view subordinates
router.get(
  "/getSingleFinalizedEmployee/:finalizedEmployeeId",
  authorize("view_single_finalized_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  getSingleFinalizedEmployee
);

// View employees by status (Active, Suspended, etc.)
// ✅ RBAC: ORGANIZATION scope
// ✅ Department: Filtered by department
router.get(
  "/status/:status",
  checkDepartment(),
  authorize("view_all_finalized_employees", { resourceType: 'EMPLOYEE' }),
  fetchEmployeesByStatus
);

// ============================================
// EMPLOYEE APPROVAL/REJECTION
// ============================================

// Approve employee registration
// ✅ RBAC: DESCENDANT scope - administrative action
// ✅ Hierarchy: Can only approve subordinates
// ✅ Power Gap: Must be superior in hierarchy
router.patch(
  "/approve/:finalizedEmployeeId",
  authorize("approve_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  ApproveEmployee
);

// Reject employee registration
// ✅ RBAC: DESCENDANT scope - administrative action
// ✅ Hierarchy: Can only reject subordinates
router.delete(
  "/reject/:finalizedEmployeeId",
  authorize("reject_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),

  RejectEmployee
);

// ============================================
// EMPLOYEE STATUS CHANGES (Administrative Actions)
// ============================================

// Suspend employee
// ✅ RBAC: DESCENDANT scope - administrative action
// ✅ Hierarchy: CRITICAL - Can only suspend subordinates
// ✅ Power Gap: Actor must have higher power rank
router.post(
  "/suspend/:employeeId",
  authorize("suspend_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  suspendEmployee
);

// Restore suspended employee
// ✅ RBAC: DESCENDANT scope - administrative action
// ✅ Hierarchy: Can only restore subordinates
router.patch(
  "/restore-suspension/:employeeId",
  authorize("restore_suspended_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  restoreSuspendedEmployee
);

// Block employee
// ✅ RBAC: DESCENDANT scope - administrative action
// ✅ Hierarchy: Can only block subordinates
router.post(
  "/block/:employeeId",
  authorize("block_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  blockEmployee
);

// Restore blocked employee
// ✅ RBAC: DESCENDANT scope - administrative action
// ✅ Hierarchy: Can only restore subordinates
router.patch(
  "/restore-block/:employeeId",
  authorize("restore_blocked_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  restoreBlockedEmployee
);

// Terminate employee
// ✅ RBAC: DESCENDANT scope - administrative action
// ✅ Hierarchy: Can only terminate subordinates
router.post(
  "/terminate/:employeeId",
  authorize("terminate_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  terminateEmployee
);

// Restore terminated employee
// ✅ RBAC: DESCENDANT scope - administrative action
// ✅ Hierarchy: Can only restore subordinates
router.patch(
  "/restore-terminate/:employeeId",
  authorize("restore_terminate_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  restoreTerminatedEmployee
);

// ============================================
// PERMANENT DELETION
// ============================================

// Permanently delete employee and finalized record
// ✅ RBAC: DESCENDANT scope - administrative action
// ✅ Hierarchy: Can only delete subordinates
// ✅ Department: Must be same department
router.delete(
  "/delete/:finalizedEmployeeId",
  authorize("delete_finalized_employee", { resourceType: 'EMPLOYEE' }),
  checkHierarchy(),
  checkDepartment(),
  deleteEmployeeAndFinalized
);

export default router;
import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import {
  getAllRolesList,
  getRoleById,
  addRole,
  updateRole,
  deleteRole,
  getEmployeeRoleAssignment,
  getRolesByDepartment,
  getRoleAssignmentsGroupedByRole,  
  getEmployeesByRole,               
  getAssignmentsByDepartment,       
} from "../contollers/RoleController.js";

const router = express.Router();
router.use(authenticate);

// ============================================
// ROLE DECLARATIONS (Global)
// ============================================

router.get("/getAllRolesList", getAllRolesList);
router.get("/:roleId", getRoleById);
router.get("/department/:code", getRolesByDepartment);
router.post("/addRole", addRole);
router.put("/:roleId", updateRole);
router.delete("/deleteRole/:roleId", deleteRole);

// ============================================
// ROLE ASSIGNMENTS (Contextual)
// ============================================

/**
 * ✅ NOTE: /assign route is in employeeRoutes.js
 * This is correct as AssignEmployeePost is in employeeController
 * Route: POST /employees/roles/assign
 */

router.get("/assignment/:employeeId", getEmployeeRoleAssignment);
router.get("/assignments/grouped", getRoleAssignmentsGroupedByRole);
router.get("/assignments/employees/:roleId", getEmployeesByRole);
router.get("/assignments/department/:code", getAssignmentsByDepartment);

export default router;

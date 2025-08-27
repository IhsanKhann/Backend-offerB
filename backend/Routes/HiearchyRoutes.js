import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import {
  addHierarchy,
  getHierarchy,

  // Division
  createDivision,
  deleteDivision,
  updateDivision,
  getAllDivisions,

  // Department
  createDepartment,
  deleteDepartment,
  updateDepartment,

  // Group
  createGroup,
  deleteGroup,
  updateGroup,

  // Cell
  createCell,
  deleteCell,
  updateCell
} from "../contollers/hiearchyController.js";

const router = express.Router();
router.use(authenticate);

// ====== Hierarchy (NO AUTH for testing) ======
router.post("/hierarchy/add-hierarchy", addHierarchy);
router.get("/hierarchy/get-hierarchy", getHierarchy);

// ====== Division Routes (NO AUTH for testing) ======
router.post("/hierarchy/add-division", createDivision);
router.post("/hierarchy/delete-division", deleteDivision);
router.put("/hierarchy/division/:id", updateDivision);
router.get("/hierarchy/get-divisions", getAllDivisions);

// ===== Department Routes =====
router.post("/hierarchy/division/:divisionId/department", createDepartment);
router.put("/hierarchy/department/:id", updateDepartment);
router.delete("/hierarchy/department/:departmentId", deleteDepartment);

// ====== Group Routes ======
router.post("/hierarchy/division/:divisionId/department/:departmentId/group", createGroup);
router.put("/hierarchy/division/:divisionId/department/:departmentId/group/:groupId", updateGroup);
router.delete("/hierarchy/group/:groupId", deleteGroup);

// ====== Cell Routes ======
router.post("/hierarchy/division/:divisionId/department/:departmentId/group/:groupId/cell", createCell);
router.put("/hierarchy/division/:divisionId/department/:departmentId/group/:groupId/cell/:cellId", updateCell);
router.delete("/hierarchy/cell/:cellId", deleteCell);

export default router;

import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import { setResourceOrgUnit } from "../middlewares/authUtility.js";
import {
  addHierarchy,
  getHierarchy,
  createHierarchyLevel,
  editHierarchyLevel,
  deleteHierarchyLevel,
} from "../contollers/hiearchyController.js";

const router = express.Router();
router.use(authenticate);

// ------------------- Hierarchy Routes -------------------

// Add full hierarchy
router.post(
  "/add-hierarchy",
  setResourceOrgUnit,
  authorize("add_hierarchy"),
  addHierarchy
);

// Get hierarchy
router.get(
  "/get-hierarchy",
  setResourceOrgUnit,
  authorize("view_hierarchy"),
  getHierarchy
);

// Create a new hierarchy level
router.post(
  "/createNode",
  setResourceOrgUnit,
  authorize("add_hierarchy_level"),
  createHierarchyLevel
);

// Edit an existing hierarchy level
router.put(
  "/editNode/:id",
  setResourceOrgUnit,
  authorize("edit_hierarchy_level"),
  editHierarchyLevel
);

// Delete a hierarchy level
router.delete(
  "/deleteNode/:id",
  setResourceOrgUnit,
  authorize("delete_hierarchy_level"),
  deleteHierarchyLevel
);

export default router;

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
  authorize("add_hierarchy"),
  addHierarchy
);

// Get hierarchy
router.get(
  "/get-hierarchy",
  authorize("view_hierarchy"),
  getHierarchy
);

// Create a new hierarchy level
router.post(
  "/createNode",
  authorize("add_HierarchyLevel"),
  createHierarchyLevel
);

// Edit an existing hierarchy level
router.put(
  "/editNode/:hierarchyId",
  // setResourceOrgUnit,
  authorize("edit_hierarchy_level"),
  editHierarchyLevel
);

// Delete a hierarchy level
router.delete(
  "/deleteNode/:id",
  // setResourceOrgUnit,
  authorize("delete_HierarchyLevel"),
  deleteHierarchyLevel
);

export default router;

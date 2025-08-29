import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import {
  addHierarchy,
  getHierarchy,
  createHierarchyLevel,
  editHierarchyLevel,
  deleteHierarchyLevel,
} from "../contollers/hiearchyController.js";

const router = express.Router();
router.use(authenticate);

// Add full hierarchy
router.post("/hierarchy/add-hierarchy", authorize("add_hierarchy"), addHierarchy);

// Get hierarchy
router.get("/hierarchy/get-hierarchy", authorize("view_hierarchy"), getHierarchy);

// Create a new hierarchy level
router.post("/hierarchy/createNode", authorize("add_hierarchy_level"), createHierarchyLevel);

// Edit an existing hierarchy level
router.put("/hierarchy/editNode/:id", authorize("edit_hierarchy_level"), editHierarchyLevel);

// Delete a hierarchy level
router.delete("/hierarchy/deleteNode/:id", authorize("delete_hierarchy_level"), deleteHierarchyLevel);

export default router;

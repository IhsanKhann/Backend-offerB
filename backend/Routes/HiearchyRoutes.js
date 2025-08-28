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

// ====== Hierarchy ======
// Add full hierarchy (initial setup)
router.post("/hierarchy/add-hierarchy", addHierarchy);

// Get hierarchy
router.get("/hierarchy/get-hierarchy", getHierarchy);

// Create a new hierarchy level (office, group, division, etc.)
router.post("/hierarchy", createHierarchyLevel);

// Edit an existing hierarchy level
router.put("/hierarchy/:id", editHierarchyLevel);

// Delete a hierarchy level
router.delete("/hierarchy/:id", deleteHierarchyLevel);

export default router;

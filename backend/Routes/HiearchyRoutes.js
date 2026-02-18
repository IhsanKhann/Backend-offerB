import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import {
  addHierarchy,
  getHierarchy,
  createHierarchyLevel,
  editHierarchyLevel,
  deleteHierarchyLevel,
} from "../contollers/hiearchyController.js";

const hierarchyRouter = express.Router();
hierarchyRouter.use(authenticate);

// DEPRECATION WARNING MIDDLEWARE
hierarchyRouter.use((req, res, next) => {
  console.warn(`
    ⚠️  DEPRECATION WARNING: /api/hierarchy endpoints are deprecated
    📌 Use /api/org-units instead
    🔗 Path: ${req.path}
    📅 This endpoint will be removed in v2.0
  `);
  
  res.setHeader('X-Deprecated-API', 'true');
  res.setHeader('X-Deprecated-Message', 'Use /api/org-units instead');
  
  next();
});

// Legacy routes - maintained for backward compatibility
hierarchyRouter.post("/add-hierarchy", authorize("add_hierarchy"), addHierarchy);
hierarchyRouter.get("/get-hierarchy", authorize("view_hierarchy"), getHierarchy);
hierarchyRouter.post("/createNode", authorize("add_HierarchyLevel"), createHierarchyLevel);
hierarchyRouter.put("/editNode/:hierarchyId", authorize("edit_hierarchy_level"), editHierarchyLevel);
hierarchyRouter.delete("/deleteNode/:id", authorize("delete_HierarchyLevel"), deleteHierarchyLevel);

export default hierarchyRouter;
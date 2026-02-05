import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import {
  createBranch,
  getAllBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
  getBranchWithOrgUnits,
  getHeadOffice,
  getBranchStats
} from "../contollers/BranchController.js";

const branchRouter = express.Router();

// All routes require authentication
branchRouter.use(authenticate);

// ✅ Get all branches - responds with { success, branches, count }
branchRouter.get("/", getAllBranches);

// ✅ Get head office
branchRouter.get("/head-office", getHeadOffice);

// ✅ NEW: Get branch with full org tree
// Returns hierarchical tree structure for branch-specific view
branchRouter.get("/:branchId/tree", getBranchWithOrgUnits);

// Get single branch by ID - responds with { success, data }
branchRouter.get("/:branchId", getBranchById);

// Get branch with org units tree (original endpoint preserved)
branchRouter.get("/:branchId/org-units", getBranchWithOrgUnits);

// Get branch statistics
branchRouter.get("/:branchId/stats", getBranchStats);

// Create branch (requires permission)
branchRouter.post(
  "/",
  authorize("MANAGE_ORGUNIT"),
  createBranch
);

// Update branch (requires permission)
branchRouter.put(
  "/:branchId",
  authorize("MANAGE_ORGUNIT"),
  updateBranch
);

// Delete branch (requires permission)
branchRouter.delete(
  "/:branchId",
  authorize("MANAGE_ORGUNIT"),
  deleteBranch
);

export default branchRouter;
import express from "express";
import {
    getSummariesWithLines,
    resetSummaries,
    initCapitalCash,
} from "../../contollers/FinanceControllers/SummaryController.js"
import { createRule } from "../../contollers/FinanceControllers/TablesControllers.js";
import { authenticate, authorize } from "../../middlewares/authMiddlewares.js";

const router = express.Router();

// Public routes
router.get("/summary-field-lines", getSummariesWithLines);

// Protected routes (admin only)
router.use(authenticate); 
// Optionally: router.use(authorize("admin"));

router.post("/create-rule", createRule);
router.post("/reset-summaries", resetSummaries);
router.post("/init-capital-cash", initCapitalCash);

export default router;

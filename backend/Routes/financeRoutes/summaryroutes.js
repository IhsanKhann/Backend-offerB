import express from "express";
import {
    getSummaries,
    getSummariesWithFieldLines,
    resetSummaries,
    initCapitalCash,
    getAllSummaries,
    getAllFieldLines,
} from "../../contollers/FinanceControllers/SummaryController.js";

import { 
    getRules,
    getRuleById, 
    createRule,
    updateRule 
} from "../../contollers/FinanceControllers/RulesController.js";
import { authenticate, authorize } from "../../middlewares/authMiddlewares.js";

const router = express.Router();

router.get("/", getSummaries);
router.get("/summaries-with-lines", getSummariesWithFieldLines);

// Protected routes (admin only)
router.use(authenticate); 
// Optionally: router.use(authorize("admin"));

router.post("/create-rule", createRule);
router.post("/reset-summaries", resetSummaries);
router.post("/init-capital-cash", initCapitalCash);

router.get("/rules", getRules);
router.get("/rules/:ruleId", getRuleById);
router.post("/rules", createRule);
router.put("/rules/:ruleId", updateRule);

// Public routes
router.get("/summaries", getAllSummaries);        // fetch only summaries
router.get("/fieldlines", getAllFieldLines);      // fetch only field lines


export default router;

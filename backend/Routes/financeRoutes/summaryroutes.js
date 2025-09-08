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
    updateRule,
    deleteRule
} from "../../contollers/FinanceControllers/RulesController.js";

import RuleModel from "../../models/FinanceModals/TablesModel.js";
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
router.delete("/rules/:ruleId/delete", deleteRule);

// Delete a split from a rule
router.delete("/:ruleId/splits/:splitIdx", async (req, res) => {
  const { ruleId, splitIdx } = req.params;
  try {
    const rule = await RuleModel.findOne({ ruleId });
    if (!rule) return res.status(404).json({ message: "Rule not found" });
    rule.splits.splice(Number(splitIdx), 1);
    await rule.save();
    res.status(200).json({ message: "Split deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting split" });
  }
});

// Delete a mirror from a split
router.delete("/:ruleId/splits/:splitIdx/mirrors/:mirrorIdx", async (req, res) => {
  const { ruleId, splitIdx, mirrorIdx } = req.params;
  try {
    const rule = await RuleModel.findOne({ ruleId });
    if (!rule) return res.status(404).json({ message: "Rule not found" });
    rule.splits[Number(splitIdx)].mirrors.splice(Number(mirrorIdx), 1);
    await rule.save();
    res.status(200).json({ message: "Mirror deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting mirror" });
  }
});

// Public routes
router.get("/summaries", getAllSummaries);        // fetch only summaries
router.get("/fieldlines", getAllFieldLines);      // fetch only field lines


export default router;

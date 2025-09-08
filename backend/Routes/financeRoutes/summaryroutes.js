import express from "express";
import {
  getSummaries,                    // plain summaries
  getSummariesWithFieldLines,      // summaries + fieldlines
  resetSummaries,
  initCapitalCash,
  getAllSummaryFieldLines,
} from "../../contollers/FinanceControllers/SummaryController.js";

import {
  getRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
} from "../../contollers/FinanceControllers/RulesController.js";

import {
  getEmployeeRules,
  createBreakupFile,
  getBreakupFile,
  initiateSalaryTransaction,
} from "../../contollers/FinanceControllers/SalaryController.js"; // new controllers

import RuleModel from "../../models/FinanceModals/TablesModel.js";
import { authenticate } from "../../middlewares/authMiddlewares.js";

const router = express.Router();

/**
 * Public routes
 */
// Summaries
router.get("/", getSummaries);                    
router.get("/summaries-with-lines", getSummariesWithFieldLines); // summaries + fieldlines
router.get("/fieldlines", getAllSummaryFieldLines);

// Rules
router.get("/rules", getRules);                               // all rules
router.get("/rules/:ruleId", getRuleById);                    // rule by id

// Salary / Breakup
router.post("/salary/rules-by-role/:roleName", getEmployeeRules);    // get employee salary rules
router.post("/salary/breakup/:employeeId", createBreakupFile); // create breakup file
router.get("/salary/breakup/:employeeId", getBreakupFile);    // get latest breakup file
router.post("/salary/transaction/:employeeId", initiateSalaryTransaction); // placeholder

/**
 * Protected routes (admin only)
 */
router.use(authenticate);

router.post("/reset-summaries", resetSummaries);
router.post("/init-capital-cash", initCapitalCash);

router.post("/rules", createRule);
router.put("/rules/:ruleId", updateRule);
router.delete("/rules/:ruleId/delete", deleteRule);

// Delete a split from a rule
router.delete("/rules/:ruleId/splits/:splitIdx", async (req, res) => {
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
router.delete("/rules/:ruleId/splits/:splitIdx/mirrors/:mirrorIdx", async (req, res) => {
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

export default router;

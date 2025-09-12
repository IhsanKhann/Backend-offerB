import express from "express";
import {
  summariesGetAll,
  summariesGetWithFieldLines,
  summariesGetAllFieldLines,
  summariesGetById,
  summariesCreateDefinition,
  summariesReset,
  summariesInitCapitalCash,
} from "../../contollers/FinanceControllers/SummaryController.js";

import {
  getRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
} from "../../contollers/FinanceControllers/RulesController.js";

import {
  getSalaryRulesByRoleName,
  getSingleSalaryRole,
  createBreakupFile,
  getBreakupFile,
} from "../../contollers/FinanceControllers/SalaryController.js";

import {
  getAllSalaryRules,
  getSalaryRulesByRole,
  updateSalaryRules,
  createRoleWithSalaryRules,
} from "../../contollers/FinanceControllers/TablesControllers.js";

import RuleModel from "../../models/FinanceModals/TablesModel.js";
import { authenticate } from "../../middlewares/authMiddlewares.js";

const router = express.Router();

/**
 * Summaries
 */
router.get("/", summariesGetAll);                       
router.get("/definitions", summariesCreateDefinition);
router.get("/with-fieldlines", summariesGetWithFieldLines);
router.get("/fieldlines", summariesGetAllFieldLines);
// router.get("/:summaryId", summariesGetById); 

/**
 * Rules
 */
router.get("/rules", getRules);
router.get("/rules/:ruleId", getRuleById);

/**
 * Salary / Breakup
 */
router.get("/salary/rules-by-role/:roleName", getSalaryRulesByRoleName);
router.post("/salary/breakup/:employeeId", createBreakupFile);
router.get("/salary/breakup/:employeeId", getBreakupFile);

/**
 * Protected (admin only)
 */
router.use(authenticate);

router.post("/reset", summariesReset);
router.post("/init-capital-cash", summariesInitCapitalCash);

router.post("/rules", createRule);
router.put("/rules/:ruleId", updateRule);
router.delete("/rules/:ruleId/delete", deleteRule);

// Delete split
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

// Delete mirror
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

/**
 * Salary rules table
 */
router.get("/salarytable/all", getAllSalaryRules);
router.get("/salarytable/:roleId", getSalaryRulesByRole);
router.put("/salarytable/:roleId", updateSalaryRules);
router.post("/salarytable", createRoleWithSalaryRules);
router.get("/salary/role/:roleName", getSingleSalaryRole);

export default router;

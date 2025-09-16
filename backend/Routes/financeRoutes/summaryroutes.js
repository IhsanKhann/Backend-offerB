import express from "express";
import mongoose from "mongoose";
import RuleModel from "../../models/FinanceModals/TablesModel.js";
import {
  getAllSummaries,
  summariesGetWithFieldLines,
  summariesGetAllFieldLines,
  getSummaryById,
  summariesCreateDefinition,
  summariesReset,
  summariesInitCapitalCash,
  getSummariesWithEntries,
} from "../../contollers/FinanceControllers/SummaryController.js";

import {
  fetchRulesForFrontend,
  getAllFieldLineDefinitions,
  createRule,
  updateRule,
  deleteRule,
} from "../../contollers/FinanceControllers/RulesController.js";

import {
  getSalaryRulesByRoleName,
  getSingleSalaryRole,
  createBreakupFile,
  getBreakupFile,
  createBreakupRule,
  getBreakupRules,
} from "../../contollers/FinanceControllers/SalaryController.js";

import {
  getAllSalaryRules,
  getSalaryRulesByRole,
  updateSalaryRules,
  createRoleWithSalaryRules,
} from "../../contollers/FinanceControllers/TablesControllers.js";

import { authenticate } from "../../middlewares/authMiddlewares.js";

const router = express.Router();

router.get("/rulesInstances", fetchRulesForFrontend);
/** ---------------------- Summaries -------------------- */
router.get("/", getAllSummaries);
router.get("/definitions", summariesCreateDefinition);
router.get("/with-fieldlines", summariesGetWithFieldLines);
router.get("/fieldlines", summariesGetAllFieldLines);
router.get("/fieldlines/definitions", getAllFieldLineDefinitions);
router.get("/:summaryId", getSummaryById);

router.post("/reset", summariesReset);
router.post("/init-capital-cash", summariesInitCapitalCash);
router.get("/with-entries", getSummariesWithEntries);

/** ---------------------- Rules -------------------- */

router.post("/rules", createRule);
router.put("/rules/:ruleId", updateRule);
router.delete("/rules/:ruleId", deleteRule);

/** Delete Split */
router.delete("/rules/:ruleId/splits/:splitIdx", async (req, res) => {
  const { ruleId, splitIdx } = req.params;
  try {
    const rule = await RuleModel.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    rule.splits.splice(Number(splitIdx), 1);
    await rule.save();
    res.status(200).json({ message: "Split deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting split" });
  }
});

/** Delete Mirror */
router.delete("/rules/:ruleId/splits/:splitIdx/mirrors/:mirrorIdx", async (req, res) => {
  const { ruleId, splitIdx, mirrorIdx } = req.params;
  try {
    const rule = await RuleModel.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    rule.splits[Number(splitIdx)].mirrors.splice(Number(mirrorIdx), 1);
    await rule.save();
    res.status(200).json({ message: "Mirror deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting mirror" });
  }
});

/** Add Split */
router.post("/rules/:ruleId/splits", async (req, res) => {
  const { ruleId } = req.params;
  const splitData = req.body;

  try {
    const rule = await RuleModel.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    rule.splits.push({
      ...splitData,
      instanceId: new mongoose.Types.ObjectId(),
      mirrors: [],
    });
    await rule.save();

    res.status(201).json(rule);
  } catch (err) {
    console.error("[Add Split Error]", err);
    res.status(500).json({ message: "Error adding split" });
  }
});

/** Add Mirror */
router.post("/rules/:ruleId/splits/:splitIdx/mirrors", async (req, res) => {
  const { ruleId, splitIdx } = req.params;
  const mirrorData = req.body;

  try {
    const rule = await RuleModel.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    rule.splits[Number(splitIdx)].mirrors.push({
      ...mirrorData,
      instanceId: new mongoose.Types.ObjectId(),
    });
    await rule.save();

    res.status(201).json(rule);
  } catch (err) {
    console.error("[Add Mirror Error]", err);
    res.status(500).json({ message: "Error adding mirror" });
  }
});

/** ---------------------- Salary / Breakup -------------------- */
router.get("/salary/rules-by-role/:roleName", getSalaryRulesByRoleName);
router.get("/salary/role/:roleName", getSingleSalaryRole);
router.post("/salary/breakup/:employeeId", createBreakupFile);
router.get("/salary/breakup/:employeeId", getBreakupFile);
router.post("/salary/createBreakupRule", createBreakupRule);
router.get("/salary/getBreakupRules", getBreakupRules);

/** Salary rules table */
router.get("/salarytable/all", getAllSalaryRules);
router.get("/salarytable/:roleId", getSalaryRulesByRole);
router.put("/salarytable/:roleId", updateSalaryRules);
router.post("/salarytable", createRoleWithSalaryRules);

router.use(authenticate);
export default router;

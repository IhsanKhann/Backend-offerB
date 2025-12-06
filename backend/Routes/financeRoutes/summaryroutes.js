import express from "express";
import mongoose from "mongoose";
import RuleModel from "../../models/FinanceModals/TablesModel.js";

import {
  getBreakupRules,
  getBreakupRuleById,
  createBusinessBreakupRule,
  updateBreakupRule,
  deleteBreakupRule,
  addSplit,
  updateSplit,
  deleteSplit,
  addMirror,
  updateMirror,
  deleteMirror,
} from "../../contollers/FinanceControllers/BreakupRulesControllers.js";

import {
  getAllSummaries,
  summariesGetWithFieldLines,
  summariesGetAllFieldLines,
  getSummaryById,
  summariesCreateDefinition,
  summariesReset,
  summariesInitCapitalCash,
  createSummary,
  deleteSummary,
  createFieldLine,
  deleteFieldLine,
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
  getEmployeeSalaryHistory,
  deleteBreakup,
} from "../../contollers/FinanceControllers/SalaryController.js";

import {
  getAllSalaryRules,
  getSalaryRulesByRole,
  updateSalaryRules,
  createRoleWithSalaryRules,
} from "../../contollers/FinanceControllers/TablesControllers.js";

import { authenticate } from "../../middlewares/authMiddlewares.js";

const router = express.Router();

// ✅ Apply authentication to all routes
router.use(authenticate);

// -------------------------------------------------------------------
// 🧩 RULES SECTION (Static First)
// -------------------------------------------------------------------
router.get("/rulesInstances", fetchRulesForFrontend);
router.get("/fieldlines/definitions", getAllFieldLineDefinitions);

router.post("/rules", createRule);

// this is for updating the rules.
router.put("/rules/:ruleId/update", updateRule);
router.delete("/rules/:ruleId", deleteRule);

// -------------------------------------------------------------------
// 💰 SALARY ROUTES
// -------------------------------------------------------------------
router.get("/salary/rules-by-role/:roleName", getSalaryRulesByRoleName);
router.get("/salary/role/:roleName", getSingleSalaryRole);
router.post("/salary/breakup/:employeeId", createBreakupFile);
router.get("/salary/breakup/:employeeId", getBreakupFile);
router.get("/salary/breakups/:employeeId", getEmployeeSalaryHistory);

// -------------------------------------------------------------------
// 💵 SALARY RULES TABLE
// -------------------------------------------------------------------
router.get("/salarytable/all", getAllSalaryRules);
router.get("/salarytable/:roleId", getSalaryRulesByRole);
router.put("/salarytable/:roleId", updateSalaryRules);
router.post("/salarytable", createRoleWithSalaryRules);

// -------------------------------------------------------------------
// 📊 BREAKUP RULES
// -------------------------------------------------------------------
router.get("/breakupRules", getBreakupRules);
router.get("/breakupRules/:id", getBreakupRuleById);
router.post("/breakupRules", createBusinessBreakupRule);
router.put("/breakupRules/:id", updateBreakupRule);
router.delete("/breakupRules/:id", deleteBreakupRule);

// 🧩 Split / Mirror Operations
router.post("/breakupRules/:id/splits", addSplit);
router.put("/breakupRules/:id/splits/:splitId", updateSplit);
router.delete("/breakupRules/:id/splits/:splitId", deleteSplit);

router.post("/breakupRules/:id/splits/:splitId/mirrors", addMirror);
router.put("/breakupRules/:id/splits/:splitId/mirrors/:mirrorId", updateMirror);
router.delete("/breakupRules/:id/splits/:splitId/mirrors/:mirrorId", deleteMirror);

// -------------------------------------------------------------------
// 📘 SUMMARIES SECTION
// -------------------------------------------------------------------

// ✅ Static routes first (exact paths)
router.get("/with-fieldlines", summariesGetWithFieldLines);
router.get("/fieldlines", summariesGetAllFieldLines);
router.post("/create-definitions", summariesCreateDefinition);

router.post("/create", createSummary);
router.post("/delete", deleteSummary);
router.post("/createFieldLines", createFieldLine);
router.post("/deleteFieldLines", deleteFieldLine);
router.post("/reset", summariesReset);
router.delete("/breakup/:breakupId", deleteBreakup);
router.post("/init-capital-cash", summariesInitCapitalCash);


// ✅ Dynamic routes last
router.get("/", getAllSummaries);
router.get("/:summaryId", getSummaryById);

// -------------------------------------------------------------------
// ✅ RULE SPLITS & MIRRORS (for dynamic rules) — kept at end
// -------------------------------------------------------------------
// for the split:
router.post("/rules/:ruleId/splits", async (req, res) => {
  const { ruleId } = req.params;
  const splitData = req.body;

  try {
    const rule = await RuleModel.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    rule.splits.push({
      ...splitData,
      // use provided instanceId (if valid) otherwise create a new ObjectId
      instanceId: splitData.instanceId
        ? mongoose.Types.ObjectId(splitData.instanceId)
        : new mongoose.Types.ObjectId(),
      // ensure isReflection exists on split
      isReflection: splitData.isReflection ?? false,
      // ensure mirrors exist and each mirror has isReflection default
      mirrors: (splitData.mirrors || []).map((m) => ({
        ...m,
        instanceId: m.instanceId ? mongoose.Types.ObjectId(m.instanceId) : new mongoose.Types.ObjectId(),
        isReflection: m.isReflection ?? false,
      })),
    });
    await rule.save();

    res.status(201).json(rule);
  } catch (err) {
    console.error("[Add Split Error]", err);
    res.status(500).json({ message: "Error adding split" });
  }
});

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

// for the mirror:
router.post("/rules/:ruleId/splits/:splitIdx/mirrors", async (req, res) => {
  const { ruleId, splitIdx } = req.params;
  const mirrorData = req.body;

  try {
    const rule = await RuleModel.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    rule.splits[Number(splitIdx)].mirrors.push({
      ...mirrorData,
      instanceId: mirrorData.instanceId
        ? mongoose.Types.ObjectId(mirrorData.instanceId)
        : new mongoose.Types.ObjectId(),
      isReflection: mirrorData.isReflection ?? false,
    });
    await rule.save();

    res.status(201).json(rule);
  } catch (err) {
    console.error("[Add Mirror Error]", err);
    res.status(500).json({ message: "Error adding mirror" });
  }
});

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

export default router;

// controllers/FinanceControllers/RuleController.js
import RuleModel from "../../models/FinanceModals/TablesModel.js";
import mongoose from "mongoose";

// GET /api/rules → fetch all rules
export const getRules = async (req, res) => {
  try {
    const rules = await RuleModel.find().lean();
    res.status(200).json(rules);
  } catch (err) {
    console.error("Error fetching rules:", err);
    res.status(500).json({ error: "Failed to fetch rules" });
  }
};

// POST /api/rules → create a new rule
export const createRule = async (req, res) => {
  try {
    const { ruleId, transactionType, incrementType, splits } = req.body;

    if (!ruleId || !transactionType || !splits) {
      return res.status(400).json({ error: "ruleId, transactionType, and splits are required" });
    }

    const existingRule = await RuleModel.findOne({ ruleId });
    if (existingRule) {
      return res.status(400).json({ error: "Rule with this ruleId already exists" });
    }

    const newRule = new RuleModel({ ruleId, transactionType, incrementType, splits });
    await newRule.save();

    res.status(201).json({ message: "Rule created successfully", rule: newRule });
  } catch (err) {
    console.error("Error creating rule:", err);
    res.status(500).json({ error: "Failed to create rule" });
  }
};

// PUT /api/rules/:ruleId → update an existing rule
export const updateRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { transactionType, incrementType, splits } = req.body;

    if (!transactionType && !splits && !incrementType) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const updatedRule = await RuleModel.findOne({ ruleId });

    if (!updatedRule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    // Update fields if provided
    if (transactionType) updatedRule.transactionType = transactionType;
    if (incrementType) updatedRule.incrementType = incrementType;
    if (splits) updatedRule.splits = splits;

    await updatedRule.save();

    res.status(200).json({ message: "Rule updated successfully", rule: updatedRule });
  } catch (err) {
    console.error("Error updating rule:", err);
    res.status(500).json({ error: "Failed to update rule" });
  }
};

// Optional: GET /api/rules/:ruleId → fetch a single rule
export const getRuleById = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const rule = await RuleModel.findOne({ ruleId: Number(ruleId) }).lean();

    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    res.status(200).json(rule);
  } catch (err) {
    console.error("Error fetching rule:", err);
    res.status(500).json({ error: "Failed to fetch rule" });
  }
};

export const deleteRule = async (req, res) => {
  const { ruleId } = req.params;

  try {
    const deletedRule = await RuleModel.findOneAndDelete({ ruleId: Number(ruleId) });

    if (!deletedRule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    return res.status(200).json({ message: "Rule deleted successfully" });
  } catch (err) {
    console.error("Error deleting rule:", err);
    return res.status(500).json({ message: "Failed to delete rule", error: err.message });
  }
};


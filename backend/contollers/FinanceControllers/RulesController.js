// controllers/RuleController.js
import mongoose from "mongoose";
import RuleModel from "../../models/FinanceModals/TablesModel.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineModel from "../../models/FinanceModals/FieldLineDefinitionModel.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";

/**
 * Fetch all rules with populated mirror summary names
 */
export const fetchRulesForFrontend = async (req, res) => {
  try {
    console.log("[fetchRulesForFrontend] Fetching rules...");

    const rules = await RuleModel.find({}).lean();
    console.log(`[fetchRulesForFrontend] Found ${rules.length} rules`);

    // Collect all summary IDs from splits/mirrors
    const summaryIds = [];
    rules.forEach((rule) => {
      rule.splits?.forEach((split) => {
        if (split.summaryId) summaryIds.push(split.summaryId);
        split.mirrors?.forEach((mirror) => {
          if (mirror.summaryId) summaryIds.push(mirror.summaryId);
        });
      });
    });

    console.log("[fetchRulesForFrontend] Summary IDs to fetch:", summaryIds);

    // Fetch summaries in one go
    const summaries = await SummaryModel.find({ _id: { $in: summaryIds } }, "_id name").lean();
    const summaryMap = {};
    summaries.forEach((s) => {
      summaryMap[s._id.toString()] = s.name;
    });

    // Populate mirror names
    const populatedRules = rules.map((rule) => {
      rule.splits = rule.splits?.map((split) => {
        split.summaryName = split.summaryId ? summaryMap[split.summaryId.toString()] || "Unknown Summary" : null;
        split.mirrors = split.mirrors?.map((mirror) => ({
          ...mirror,
          summaryName: mirror.summaryId ? summaryMap[mirror.summaryId.toString()] || "Unknown Summary" : null,
        }));
        return split;
      });
      return rule;
    });

    res.json(populatedRules);
  } catch (err) {
    console.error("[fetchRulesForFrontend] Error:", err);
    res.status(500).json({ message: "Failed to fetch rules" });
  }
};

/**
 * Create a new rule
 */
export const createRule = async (req, res) => {
  try {
    console.log("[createRule] Creating rule with body:", req.body);

    const newRule = new RuleModel(req.body);

    newRule.splits = newRule.splits?.map((split) => ({
      ...split,
      instanceId: split.instanceId || new mongoose.Types.ObjectId(),
      mirrors: split.mirrors || [],
    })) || [];

    await newRule.save();
    console.log("[createRule] Rule created:", newRule._id);
    res.status(201).json(newRule);
  } catch (err) {
    console.error("[createRule] Error:", err);
    res.status(500).json({ message: "Failed to create rule" });
  }
};

/**
 * Update an existing rule
 */
export const updateRule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Rule ID" });
    }

    const updatedData = req.body;
    updatedData.splits = updatedData.splits?.map((split) => ({
      ...split,
      instanceId: split.instanceId || new mongoose.Types.ObjectId(),
      mirrors: split.mirrors || [],
    })) || [];

    const rule = await RuleModel.findByIdAndUpdate(id, updatedData, { new: true });
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    console.log("[updateRule] Rule updated:", id);
    res.json(rule);
  } catch (err) {
    console.error("[updateRule] Error:", err);
    res.status(500).json({ message: "Failed to update rule" });
  }
};

/**
 * Delete a rule
 */
export const deleteRule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Rule ID" });
    }

    const rule = await RuleModel.findByIdAndDelete(id);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    console.log("[deleteRule] Rule deleted:", id);
    res.json({ message: "Rule deleted successfully" });
  } catch (err) {
    console.error("[deleteRule] Error:", err);
    res.status(500).json({ message: "Failed to delete rule" });
  }
};


export const getAllFieldLineDefinitions = async (req, res) => {
  console.log("[getAllFieldLineDefinitions] Fetching definitions...");
  try {
    const defs = await SummaryFieldLineModel.find();

    // Fetch instances and populate their summary
    const instances = await SummaryFieldLineInstance.find()
      .populate("summaryId", "name") // gets summary name
      .populate("definitionId", "name"); // gets definition name

    // Group instances under definitions
    const defsWithInstances = defs.map((def) => ({
      ...def.toObject(),
      instances: instances
        .filter((inst) => inst.definitionId?._id?.toString() === def._id.toString())
        .map((inst) => ({
          _id: inst._id,
          name: inst.name,
          summaryName: inst.summaryId?.name || "No Summary",
        })),
    }));

    console.log("[getAllFieldLineDefinitions] Success", defsWithInstances);
    res.json(defsWithInstances);
  } catch (err) {
    console.error("[getAllFieldLineDefinitions] Error:", err);
    res.status(500).json({ error: err.message });
  }
};
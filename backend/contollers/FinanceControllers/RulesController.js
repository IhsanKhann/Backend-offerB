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
    const summaryIdsSet = new Set();
    for (const rule of rules) {
      if (!rule.splits) continue;

      for (const split of rule.splits) {
        if (split.summaryId) summaryIdsSet.add(split.summaryId.toString());

        if (split.mirrors) {
          for (const mirror of split.mirrors) {
            if (mirror.summaryId) summaryIdsSet.add(mirror.summaryId.toString());
          }
        }
      }
    }

    const summaryIds = Array.from(summaryIdsSet);
    console.log("[fetchRulesForFrontend] Summary IDs to fetch:", summaryIds);

    // Fetch summaries
    const summaries = await SummaryModel.find({ _id: { $in: summaryIds } }, "_id name").lean();
    const summaryMap = {};
    summaries.forEach((s) => {
      summaryMap[s._id.toString()] = { _id: s._id, name: s.name };
    });

    // Populate rules with summaryId and summaryName
    const populatedRules = [];
    for (const rule of rules) {
      const splits = [];
      for (const split of rule.splits || []) {
        const populatedMirrors = [];
        for (const mirror of split.mirrors || []) {
          const smap = mirror.summaryId ? summaryMap[mirror.summaryId.toString()] : null;
          populatedMirrors.push({
            ...mirror,
            summaryId: smap?._id || null,
            summaryName: smap?.name || "Unknown Summary",
          });
        }

        const smap = split.summaryId ? summaryMap[split.summaryId.toString()] : null;
        splits.push({
          ...split,
          summaryId: smap?._id || null,
          summaryName: smap?.name || "Unknown Summary",
          mirrors: populatedMirrors,
        });
      }
      populatedRules.push({ ...rule, splits });
    }

    res.json(populatedRules);
  } catch (err) {
    console.error("[fetchRulesForFrontend] Error:", err);
    res.status(500).json({ message: "Failed to fetch rules", error: err.message });
  }
};

export const getAllFieldLineDefinitions = async (req, res) => {
  try {
    console.log("[getAllFieldLineDefinitions] Fetching definitions and instances...");

    const defs = await SummaryFieldLineModel.find().lean();
    const instances = await SummaryFieldLineInstance.find()
      .populate("summaryId", "_id name")  // get summary ID and name
      .populate("definitionId", "_id name")
      .lean();

    const defsWithInstances = defs.map((def) => {
      const relatedInstances = instances
        .filter((inst) => inst.definitionId?._id.toString() === def._id.toString())
        .map((inst) => ({
          _id: inst._id,
          name: inst.name,
          summaryId: inst.summaryId?._id || null,
          summaryName: inst.summaryId?.name || "No Summary",
        }));

      return { ...def, instances: relatedInstances };
    });

    res.json(defsWithInstances);
  } catch (err) {
    console.error("[getAllFieldLineDefinitions] Error:", err);
    res.status(500).json({ error: err.message });
  }
};
export const createRule = async (req, res) => {
  try {
    const data = req.body;

    data.splits =
      data.splits?.map((split) => ({
        ...split,
        isReflection: split.isReflection ?? false, // NEW: default for split
        mirrors:
          split.mirrors?.map((mir) => ({
            ...mir,
            isReflection: mir.isReflection ?? false, // ensure mirror flag
          })) || [],
      })) || [];

    const newRule = await RuleModel.create(data);
    res.status(201).json(newRule);
  } catch (err) {
    console.error("createRule error:", err);
    res.status(500).json({ message: "Failed to create rule" });
  }
};

export const updateRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updated = req.body;

    // Ensure isReflection exists
    updated.splits = updated.splits?.map((split) => ({
      ...split,
      isReflection: split.isReflection ?? false,
      mirrors: split.mirrors?.map((mir) => ({
        ...mir,
        isReflection: mir.isReflection ?? false,
      })) || [],
    })) || [];

    const rule = await RuleModel.findByIdAndUpdate(ruleId, updated, {
      new: true,
      runValidators: true, // <-- validate the schema
    });

    if (!rule) return res.status(404).json({ message: "Rule not found" });

    console.log("✅ Updated rule:", rule); // <-- log after saving
    res.json(rule);
  } catch (err) {
    console.error("updateRule error:", err);
    res.status(500).json({ message: "Failed to update rule" });
  }
};

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


// run().catch((err) => { console.error(err); process.exit(1); });
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

// run().catch((err) => { console.error(err); process.exit(1); });
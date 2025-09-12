// controllers/FinanceControllers/RuleController.js
import RuleModel from "../../models/FinanceModals/TablesModel.js";
import SummaryFieldLineModel from "../../models/FinanceModals/FieldLineInstanceModel.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
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

// Add this helper function to your controller file
const convertNumericIdToObjectId = async (numericId) => {
  const summary = await SummaryModel.findOne({ summaryId: Number(numericId) });
  return summary ? summary._id : null;
};

const convertObjectIdToNumericId = async (objectId) => {
  const summary = await SummaryModel.findById(objectId);
  return summary ? summary.summaryId : null;
};

export const updateRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { transactionType, incrementType, splits } = req.body;

    const rule = await RuleModel.findOne({ ruleId: Number(ruleId) });
    if (!rule) return res.status(404).json({ error: "Rule not found" });

    if (transactionType) rule.transactionType = transactionType;
    if (incrementType) rule.incrementType = incrementType;

    if (splits) {
      for (let split of splits) {
        // Handle main split
        if (!split.summaryId) throw new Error("Split must have a summaryId");
        
        // Convert string/ObjectId to number if needed
        let summaryIdNum;
        if (typeof split.summaryId === 'string' && split.summaryId.length === 24) {
          // This is an ObjectId, find the corresponding numeric ID
          const summary = await SummaryModel.findById(split.summaryId);
          if (!summary) throw new Error(`Summary not found for ObjectId ${split.summaryId}`);
          summaryIdNum = summary.summaryId;
        } else {
          // This should be a numeric ID
          summaryIdNum = Number(split.summaryId);
        }

        const summary = await SummaryModel.findOne({ summaryId: summaryIdNum });
        if (!summary) throw new Error(`Summary not found for ID ${summaryIdNum}`);

        let existingFieldLine = await SummaryFieldLineModel.findOne({
          name: split.fieldName,
          summaryId: summary._id
        });

        if (!existingFieldLine) {
          // Generate a unique fieldLineId
          const lastFieldLine = await SummaryFieldLineModel.findOne().sort({ fieldLineId: -1 });
          const newFieldLineId = lastFieldLine ? lastFieldLine.fieldLineId + 1 : 1001;

          const newFieldLine = new SummaryFieldLineModel({
            fieldLineId: newFieldLineId,
            name: split.fieldName,
            summaryId: summary._id,
            balance: 0
          });
          await newFieldLine.save();
          split.fieldLineId = newFieldLineId;
        } else {
          split.fieldLineId = existingFieldLine.fieldLineId;
        }

        // Update the split summaryId to be numeric for storage
        split.summaryId = summaryIdNum;

        // Handle mirrors
        if (split.mirrors && split.mirrors.length > 0) {
          for (let mirror of split.mirrors) {
            if (!mirror.summaryId) throw new Error("Mirror must have a summaryId");

            // Convert string/ObjectId to number if needed
            let mirrorSummaryIdNum;
            if (typeof mirror.summaryId === 'string' && mirror.summaryId.length === 24) {
              const mirrorSummary = await SummaryModel.findById(mirror.summaryId);
              if (!mirrorSummary) throw new Error(`Summary not found for ObjectId ${mirror.summaryId}`);
              mirrorSummaryIdNum = mirrorSummary.summaryId;
            } else {
              mirrorSummaryIdNum = Number(mirror.summaryId);
            }

            let mirrorSummary = await SummaryModel.findOne({ 
              summaryId: mirrorSummaryIdNum 
            });
            if (!mirrorSummary) throw new Error(`Summary not found for ID ${mirrorSummaryIdNum}`);

            let existingMirrorFieldLine = await SummaryFieldLineModel.findOne({
              name: split.fieldName,
              summaryId: mirrorSummary._id
            });

            if (!existingMirrorFieldLine) {
              // Generate a unique fieldLineId for mirror
              const lastFieldLine = await SummaryFieldLineModel.findOne().sort({ fieldLineId: -1 });
              const newFieldLineId = lastFieldLine ? lastFieldLine.fieldLineId + 1 : 1001;

              const newMirrorFieldLine = new SummaryFieldLineModel({
                fieldLineId: newFieldLineId,
                name: split.fieldName,
                summaryId: mirrorSummary._id,
                balance: 0
              });
              await newMirrorFieldLine.save();
              mirror.fieldLineId = newFieldLineId;
            } else {
              mirror.fieldLineId = existingMirrorFieldLine.fieldLineId;
            }

            // Update the mirror summaryId to be numeric for storage
            mirror.summaryId = mirrorSummaryIdNum;
          }
        }
      }

      rule.splits = splits;
    }

    await rule.save();
    res.status(200).json({ message: "Rule updated successfully", rule });
  } catch (err) {
    console.error("Error updating rule:", err);
    res.status(500).json({ error: "Failed to update rule", details: err.message });
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


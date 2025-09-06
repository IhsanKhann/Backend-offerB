// controllers/ruleController.js
import Rule from "../../models/FinanceModals/TablesModel.js";

/**
 * Create a new rule (like making a "table")
 */
export const createRule = async (req, res) => {
  try {
    const { ruleId, transactionType, incrementType, splits } = req.body;

    // Check if ruleId already exists
    const existing = await Rule.findOne({ ruleId });
    if (existing) {
      return res.status(400).json({ message: `Rule with ruleId ${ruleId} already exists.` });
    }

    // Create new rule
    const newRule = new Rule({
      ruleId,
      transactionType,
      incrementType,
      splits,
    });

    await newRule.save();

    res.status(201).json({
      message: "Rule created successfully",
      rule: newRule,
    });
  } catch (error) {
    console.error("Error creating rule:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get all rules (list of "tables")
 */
export const getRules = async (req, res) => {
  try {
    const rules = await Rule.find();
    res.status(200).json(rules);
  } catch (error) {
    console.error("Error fetching rules:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get one rule by ID
 */
export const getRuleById = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await Rule.findOne({ ruleId: id });

    if (!rule) {
      return res.status(404).json({ message: `Rule with ruleId ${id} not found` });
    }

    res.status(200).json(rule);
  } catch (error) {
    console.error("Error fetching rule:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

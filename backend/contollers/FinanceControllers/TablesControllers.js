// controllers/ruleController.js
import Rule from "../../models/FinanceModals/TablesModel.js";
import AllRoles from "../../models/HRModals/AllRoles.model.js";

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

// 1. Get all salary rules for all roles
export const getAllSalaryRules = async (req, res) => {
  try {
    const roles = await AllRoles.find({}, { name: 1, description: 1, salaryRules: 1 });
    res.status(200).json({ success: true, data: roles });
  } catch (err) {
    console.error("Error fetching salary rules:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 2. Get salary rules for a single role by ID
export const getSalaryRulesByRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const role = await AllRoles.findById(roleId);
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });

    res.status(200).json({ success: true, data: role.salaryRules });
  } catch (err) {
    console.error("Error fetching role salary rules:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 3. Update salary rules for a role
export const updateSalaryRules = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { salaryRules } = req.body;

    // Validate salaryRules object minimally
    if (!salaryRules || !salaryRules.baseSalary) {
      return res.status(400).json({ success: false, message: "Invalid salary rules" });
    }

    const updatedRole = await AllRoles.findByIdAndUpdate(
      roleId,
      { salaryRules },
      { new: true, runValidators: true }
    );

    if (!updatedRole) return res.status(404).json({ success: false, message: "Role not found" });

    res.status(200).json({ success: true, data: updatedRole.salaryRules });
  } catch (err) {
    console.error("Error updating salary rules:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 4. Optionally: Add a new role with salary rules
export const createRoleWithSalaryRules = async (req, res) => {
  try {
    const { name, description, salaryRules } = req.body;
    if (!name || !salaryRules || !salaryRules.baseSalary) {
      return res.status(400).json({ success: false, message: "Invalid data" });
    }

    const role = await AllRoles.create({ name, description, salaryRules });
    res.status(201).json({ success: true, data: role });
  } catch (err) {
    console.error("Error creating role:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

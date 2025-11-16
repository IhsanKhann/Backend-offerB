import mongoose from "mongoose";
import AllRolesModel from "../../models/HRModals/AllRoles.model.js";
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";
import BreakupFile from "../../models/FinanceModals/SalaryBreakupModel.js";
import BreakupRulesModel from "../../models/FinanceModals/BreakupRules.js";

// ------------------------------------------------------------
// UTILITY
// ------------------------------------------------------------
const safeToObjectId = (id) => {
  if (!id) return null;
  const idStr = String(id);
  return mongoose.Types.ObjectId.isValid(idStr)
    ? new mongoose.Types.ObjectId(idStr)
    : null;
};

// GET SALARY RULES BY ROLE NAME
export const getSalaryRulesByRoleName = async (req, res) => {
  try {
    const roleNameDecoded = decodeURIComponent(req.params.roleName).trim();

    const role = await AllRolesModel.findOne({
      name: { $regex: new RegExp(`^${roleNameDecoded}$`, "i") },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: `Role '${roleNameDecoded}' not found`,
      });
    }

    return res.status(200).json({ success: true, data: role });
  } catch (err) {
    console.error("Error fetching salary rules:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET SALARY RULE OBJECT ONLY
export const getSingleSalaryRole = async (req, res) => {
  try {
    const roleNameDecoded = decodeURIComponent(req.params.roleName).trim();

    const role = await AllRolesModel.findOne({
      name: { $regex: new RegExp(`^${roleNameDecoded}$`, "i") },
    });

    if (!role)
      return res.status(404).json({ success: false, message: "Role not found" });

    return res
      .status(200)
      .json({ success: true, data: role.salaryRules || null });
  } catch (err) {
    console.error("Error fetching salary rules:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET BREAKUP FILE
export const getBreakupFile = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const breakup = await BreakupFile.findOne({ employeeId })
      .populate("employeeId", "individualName personalEmail")
      .populate("roleId", "name");

    if (!breakup) {
      return res
        .status(404)
        .json({ success: false, message: "Breakup file not found" });
    }

    return res.status(200).json({ success: true, data: breakup });
  } catch (err) {
    console.error("Error fetching breakup file:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// CREATE / UPDATE BREAKUP FILE (MAIN CONTROLLER)
export const createBreakupFile = async (req, res) => {
  try {
    const { employeeId, roleId } = req.body;

    if (!employeeId || !roleId) {
      return res.status(400).json({
        success: false,
        message: "employeeId and roleId are required",
      });
    }

    const empObjectId = safeToObjectId(employeeId);
    const roleObjectId = safeToObjectId(roleId);

    // 1) Validate employee
    const employee = await FinalizedEmployeeModel.findById(empObjectId);
    if (!employee)
      return res.status(404).json({ success: false, message: "Employee not found" });

    // 2) Fetch role & salaryRules from DB
    const role = await AllRolesModel.findById(roleObjectId);
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });

    const salaryRules = role.salaryRules;
    if (!salaryRules) {
      return res.status(400).json({
        success: false,
        message: "This role has no salaryRules defined",
      });
    }

    const {
      baseSalary = 0,
      salaryType = "monthly",
      allowances = [],
      deductions = [],
      terminalBenefits = [],
    } = salaryRules;

    // 3) Build breakup lines
    const breakdown = [];
    breakdown.push({
      name: "Base Salary",
      category: "base",
      value: Number(baseSalary),
      calculation: `Base Salary = ${Number(baseSalary)}`,
      excludeFromTotals: false,
    });

    let totalAllowances = 0;
    let totalDeductions = 0;

    // Allowances
    for (const a of allowances) {
      const calc = a.type === "percentage" ? Math.round((baseSalary * a.value) / 100) : Number(a.value);
      breakdown.push({
        name: a.name,
        category: "allowance",
        value: calc,
        calculation: a.type === "percentage" ? `${a.value}% of base = ${calc}` : `Fixed = ${calc}`,
        excludeFromTotals: false,
      });
      totalAllowances += calc;
    }

    // Deductions
    for (const d of deductions) {
      const calc = d.type === "percentage" ? Math.round((baseSalary * d.value) / 100) : Number(d.value);
      breakdown.push({
        name: d.name,
        category: "deduction",
        value: calc,
        calculation: d.type === "percentage" ? `${d.value}% of base = ${calc}` : `Fixed = ${calc}`,
        excludeFromTotals: false,
      });
      totalDeductions += calc;
    }

    // Terminal benefits lines (do not affect totals)
    // We'll compute per-benefit totals to add to employee record later
    const terminalBenefitTotals = {}; // { gratuity: 0, eobi: 0, ... , otherBenefits: 0 }

    for (const t of terminalBenefits) {
      const calc = t.type === "percentage" ? Math.round((baseSalary * t.value) / 100) : Number(t.value);

      // push into breakdown as terminalBenefit
      breakdown.push({
        name: t.name,
        category: "terminalBenefit",
        value: calc,
        calculation: t.type === "percentage" ? `${t.value}% of base = ${calc}` : `Fixed = ${calc}`,
        excludeFromTotals: true,
      });

      // normalize name into a field we maintain on employee.salary.terminalBenefits
      const nameKey = (t.name || "").toLowerCase();

      let field = "otherBenefits";
      if (nameKey.includes("gratuity")) field = "gratuity";
      else if (nameKey.includes("provident")) field = "providentFund";
      else if (nameKey.includes("eobi")) field = "eobi";
      else if (nameKey.includes("cost") || nameKey.includes("cost of funds")) field = "costOfFunds";
      else if (nameKey.includes("group") || nameKey.includes("insurance")) field = "groupTermInsurance";
      else field = "otherBenefits";

      terminalBenefitTotals[field] = (terminalBenefitTotals[field] || 0) + calc;
    }

    // Net salary
    const netSalary = Number(baseSalary) + totalAllowances - totalDeductions;
    breakdown.push({
      name: "Net Salary",
      category: "net",
      value: netSalary,
      calculation: `(Base + Allowances) - Deductions = ${netSalary}`,
      excludeFromTotals: false,
    });

    // 4) UPSERT breakupFile (create or update)
    const now = new Date();

    const breakupFile = await BreakupFile.findOneAndUpdate(
      { employeeId: empObjectId },
      {
        $set: {
          roleId: roleObjectId,
          salaryRules, // persist the role's rules used
          calculatedBreakup: {
            breakdown,
            totalAllowances,
            totalDeductions,
            netSalary,
          },
        },
      },
      { new: true, upsert: true }
    );

    // 5) Accumulate terminal benefits into employee profile — but only once per calendar month
    // Check if this employee already has a breakup created this calendar month.
    const existing = await BreakupFile.findOne({ employeeId: empObjectId }).sort({ createdAt: -1 }).lean();
    let alreadyProcessedThisMonth = false;
    if (existing && existing.createdAt) {
      const prev = new Date(existing.createdAt);
      if (prev.getFullYear() === now.getFullYear() && prev.getMonth() === now.getMonth()) {
        // if the existing record is same as the one we just upserted (same id), skip accumulation
        // Note: findOneAndUpdate returned the latest doc; compare _id
        if (String(existing._id) === String(breakupFile._id)) {
          // we just created/updated this doc — still need to ensure we only add once per month
          // if this is the first creation this month then there was no earlier one — but to be safe
          // check if there was a previous createdAt before this one (hard to determine here).
          // Simpler policy: if existing.createdAt month === now month AND existing._id !== breakupFile._id,
          // then someone already processed this month.
          alreadyProcessedThisMonth = false; // we created/updated the doc; count accumulation below
        } else {
          // there exists another breakup in the same month (older or different) — skip accumulation
          alreadyProcessedThisMonth = true;
        }
      }
    }

    // Better approach: Only accumulate if there was NO breakup BEFORE this current one in the same month.
    // We'll check if there exists any breakup for this employee with createdAt in this same month and _id !== breakupFile._id.
    if (!alreadyProcessedThisMonth) {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const otherInMonth = await BreakupFile.findOne({
        employeeId: empObjectId,
        _id: { $ne: breakupFile._id },
        createdAt: { $gte: monthStart, $lt: monthEnd },
      }).lean();

      if (otherInMonth) {
        // There's another breakup record in the same calendar month => skip accumulation to prevent double-add
        alreadyProcessedThisMonth = true;
      } else {
        alreadyProcessedThisMonth = false;
      }
    }

    if (!alreadyProcessedThisMonth) {
      // Ensure employee.salary.terminalBenefits exists
      employee.salary = employee.salary || {};
      employee.salary.terminalBenefits = employee.salary.terminalBenefits || {
        gratuity: 0,
        providentFund: 0,
        eobi: 0,
        costOfFunds: 0,
        groupTermInsurance: 0,
        otherBenefits: 0,
      };

      // Add each terminal benefit total
      for (const [field, amount] of Object.entries(terminalBenefitTotals)) {
        if (!amount || isNaN(amount)) continue;
        employee.salary.terminalBenefits[field] = (employee.salary.terminalBenefits[field] || 0) + Number(amount);
      }

      // Save employee
      await employee.save();
    }

    // 6) Return result
    return res.status(201).json({
      success: true,
      message: "Salary breakup created/updated successfully",
      data: breakupFile,
      accumulated: !alreadyProcessedThisMonth,
    });
  } catch (err) {
    console.error("❌ ERROR createBreakupFile:", err);
    return res.status(500).json({
      success: false,
      message: "Error creating breakup file",
      error: err.message,
    });
  }
};

// CREATE BREAKUP RULE
export const createBreakupRule = async (req, res) => {
  try {
    const { transactionType, incrementType, splits } = req.body;

    if (!transactionType || !splits || splits.length === 0) {
      return res.status(400).json({
        error: "transactionType and at least one split are required",
      });
    }

    const formattedSplits = splits.map((split) => ({
      componentName: split.componentName,
      type: split.type,
      instanceId: safeToObjectId(split.instanceId),
      summaryId: safeToObjectId(split.summaryId),
      definitionId: safeToObjectId(split.definitionId),
      debitOrCredit: split.debitOrCredit,
      fieldLineId: split.fieldLineId || null,
      mirrors: (split.mirrors || []).map((mirror) => ({
        instanceId: safeToObjectId(mirror.instanceId),
        summaryId: safeToObjectId(mirror.summaryId),
        definitionId: safeToObjectId(mirror.definitionId),
        debitOrCredit: mirror.debitOrCredit,
        fallback: mirror.fallback || "none",
        fieldLineId: mirror.fieldLineId || null,
      })),
    }));

    const newRule = new BreakupRulesModel({
      transactionType,
      incrementType: incrementType || "both",
      splits: formattedSplits,
    });

    await newRule.save();

    return res.status(201).json({
      message: "Breakup rule created successfully",
      rule: newRule,
    });
  } catch (err) {
    console.error("createBreakupRule Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// GET ALL BREAKUP RULES
export const getBreakupRules = async (req, res) => {
  try {
    const rules = await BreakupRulesModel.find().lean();
    return res.status(200).json(rules);
  } catch (err) {
    console.error("getBreakupRules Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

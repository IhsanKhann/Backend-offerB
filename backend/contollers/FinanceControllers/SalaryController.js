import mongoose from "mongoose";
import AllRolesModel from "../../models/HRModals/AllRoles.model.js";
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";
import BreakupFile from "../../models/FinanceModals/SalaryBreakupModel.js";
import BreakupRulesModel from "../../models/FinanceModals/BreakupRules.js";
import SalaryBreakupfiles from "../../models/FinanceModals/SalaryBreakupModel.js";

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

export const createBreakupFile = async (req, res) => {
  try {
    const { employeeId, roleId, month, year } = req.body;

    if (!employeeId || !roleId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: "employeeId, roleId, month and year are required",
      });
    }

    const empObjectId = safeToObjectId(employeeId);
    const roleObjectId = safeToObjectId(roleId);

    // Validate employee
    const employee = await FinalizedEmployeeModel.findById(empObjectId);
    if (!employee)
      return res.status(404).json({ success: false, message: "Employee not found" });

    // Validate role
    const role = await AllRolesModel.findById(roleObjectId);
    if (!role)
      return res.status(404).json({ success: false, message: "Role not found" });

    // ---------------- CHECK EXISTING BREAKUP ----------------
    const existingBreakup = await BreakupFile.findOne({ employeeId: empObjectId, month, year });

    if (existingBreakup) {
      return res.status(400).json({
        success: false,
        message: `Salary breakup for ${month} ${year} already exists. Check salary history.`,
        month,
        status: existingBreakup.paidAt ? "paid" : "processing",
      });
    }

    const { baseSalary = 0, allowances = [], deductions = [], terminalBenefits = [] } = role.salaryRules || {};

    // ---------------- BUILD BREAKDOWN ----------------
    const breakdown = [];
    let totalAllowances = 0;
    let totalDeductions = 0;

    breakdown.push({
      name: "Base Salary",
      category: "base",
      value: Number(baseSalary),
      calculation: `Base Salary = ${Number(baseSalary)}`,
      excludeFromTotals: false,
    });

    allowances.forEach(a => {
      const calc = a.type === "percentage" ? Math.round((baseSalary * a.value) / 100) : Number(a.value);
      breakdown.push({
        name: a.name,
        category: "allowance",
        value: calc,
        calculation: a.type === "percentage" ? `${a.value}% of base = ${calc}` : `Fixed = ${calc}`,
        excludeFromTotals: false,
      });
      totalAllowances += calc;
    });

    deductions.forEach(d => {
      const calc = d.type === "percentage" ? Math.round((baseSalary * d.value) / 100) : Number(d.value);
      breakdown.push({
        name: d.name,
        category: "deduction",
        value: calc,
        calculation: d.type === "percentage" ? `${d.value}% of base = ${calc}` : `Fixed = ${calc}`,
        excludeFromTotals: false,
      });
      totalDeductions += calc;
    });

    terminalBenefits.forEach(t => {
      const calc = t.type === "percentage" ? Math.round((baseSalary * t.value) / 100) : Number(t.value);
      breakdown.push({
        name: t.name,
        category: "terminal",
        value: calc,
        calculation: t.type === "percentage" ? `${t.value}% of base = ${calc}` : `Fixed = ${calc}`,
        excludeFromTotals: true,
      });
    });

    const netSalary = Number(baseSalary) + totalAllowances - totalDeductions;
    breakdown.push({
      name: "Net Salary",
      category: "net",
      value: netSalary,
      calculation: `(Base + Allowances) - Deductions = ${netSalary}`,
      excludeFromTotals: false,
    });

    // ---------------- SAVE BREAKUP FILE ----------------
    const breakupFile = new BreakupFile({
      employeeId: empObjectId,
      roleId: roleObjectId,
      salaryRules: role.salaryRules,
      calculatedBreakup: {
        breakdown,
        totalAllowances,
        totalDeductions,
        netSalary,
      },
      month,
      year,
    });

    await breakupFile.save();

    return res.status(201).json({
      success: true,
      message: `Salary breakup for ${month} ${year} created successfully`,
      data: breakupFile,
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

// history of the salaries paid of a specific employee
export const getEmployeeSalaryHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // Fetch breakups
    const breakups = await SalaryBreakupfiles.find({ employeeId })
      .populate("employeeId", "individualName personalEmail UserId")
      .populate("roleId", "roleName name")
      .sort({ createdAt: -1 })
      .lean();

    if (!breakups.length) {
      return res.status(404).json({
        success: false,
        message: "No salary history found",
      });
    }

    // Compile full documents for frontend
    const compiled = breakups.map((b) => ({
      breakupId: b._id,
      month: b.month,
      year: b.year,
      paidFor: b.paidFor || `${b.month} ${b.year}`,
      salaryRules: b.salaryRules,              // include full rules
      calculatedBreakup: b.calculatedBreakup,  // include totals + breakdown
      paidAt: b.paidAt,
      paidOnDate: b.paidAt ? new Date(b.paidAt).toDateString() : null,
      paidOnTime: b.paidAt ? new Date(b.paidAt).toLocaleTimeString() : null,
      createdAt: b.createdAt,
    }));

    return res.status(200).json({
      success: true,
      count: compiled.length,
      breakups: compiled,
    });

  } catch (err) {
    console.error("❌ Error fetching salary history:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching salary history",
    });
  }
};

// DELETE SALARY BREAKUP
export const deleteBreakup = async (req, res) => {
  const { breakupId } = req.params;

  if (!breakupId) {
    return res.status(400).json({ success: false, message: "Breakup ID is required" });
  }

  try {
    const deleted = await SalaryBreakupfiles.findByIdAndDelete(breakupId);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Breakup not found" });
    }

    return res.json({ success: true, message: "Breakup deleted successfully" });
  } catch (err) {
    console.error("Error deleting breakup:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

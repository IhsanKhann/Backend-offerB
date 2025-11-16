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
    const { employeeId, roleId, salaryRules } = req.body;

    if (!employeeId || !roleId || !salaryRules) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
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

    // Extract salary rules from frontend
    const {
      baseSalary = 0,
      salaryType = "monthly",
      allowances = [],
      deductions = [],
      terminalBenefits = [],
    } = salaryRules;

    const breakdown = [];

    // ------------------------------------------------------------
    // BASE SALARY
    // ------------------------------------------------------------
    breakdown.push({
      name: "Base Salary",
      category: "base",
      value: Number(baseSalary),
      calculation: `Base Salary = ${Number(baseSalary)}`,
      excludeFromTotals: false,
    });

    let totalAllowances = 0;
    let totalDeductions = 0;

    // ------------------------------------------------------------
    // ALLOWANCES
    // ------------------------------------------------------------
    for (const a of allowances) {
      let calc = 0;

      if (a.type === "percentage") {
        calc = Math.round((Number(baseSalary) * Number(a.value)) / 100);
      } else {
        calc = Number(a.value);
      }

      breakdown.push({
        name: a.name,
        category: "allowance",
        value: calc,
        calculation:
          a.type === "percentage"
            ? `${a.value}% of base = ${calc}`
            : `Fixed = ${calc}`,
        excludeFromTotals: false,
      });

      totalAllowances += calc;
    }

    // ------------------------------------------------------------
    // DEDUCTIONS
    // ------------------------------------------------------------
    for (const d of deductions) {
      let calc = 0;

      if (d.type === "percentage") {
        calc = Math.round((Number(baseSalary) * Number(d.value)) / 100);
      } else {
        calc = Number(d.value);
      }

      breakdown.push({
        name: d.name,
        category: "deduction",
        value: calc,
        calculation:
          d.type === "percentage"
            ? `${d.value}% of base = ${calc}`
            : `Fixed = ${calc}`,
        excludeFromTotals: false,
      });

      totalDeductions += calc;
    }

    // ------------------------------------------------------------
    // TERMINAL BENEFITS (ADD BUT DO NOT PUT INTO TOTAL ALLOWANCES)
    // ------------------------------------------------------------
    for (const t of terminalBenefits) {
      let calc = 0;

      if (t.type === "percentage") {
        calc = Math.round((Number(baseSalary) * Number(t.value)) / 100);
      } else {
        calc = Number(t.value);
      }

      breakdown.push({
        name: t.name,
        category: "allowance",
        value: calc,
        calculation:
          t.type === "percentage"
            ? `${t.value}% of base = ${calc}`
            : `Fixed = ${calc}`,
        excludeFromTotals: true, // << IMPORTANT
      });
    }

    // ------------------------------------------------------------
    // NET SALARY
    // ------------------------------------------------------------
    const netSalary =
      Number(baseSalary) + Number(totalAllowances) - Number(totalDeductions);

    breakdown.push({
      name: "Net Salary",
      category: "net",
      value: netSalary,
      calculation: `(Base + Allowances) - Deductions = ${netSalary}`,
      excludeFromTotals: false,
    });

    // ------------------------------------------------------------
    // UPSERT INTO DB
    // ------------------------------------------------------------
    const breakupFile = await BreakupFile.findOneAndUpdate(
      { employeeId: empObjectId },
      {
        $set: {
          roleId: roleObjectId,
          salaryRules: {
            baseSalary,
            salaryType,
            components: [...allowances, ...deductions, ...terminalBenefits],
          },
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

    return res.status(201).json({
      success: true,
      message: "Salary breakup created/updated successfully",
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

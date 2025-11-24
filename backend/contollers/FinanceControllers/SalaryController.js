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

    const salaryRules = role.salaryRules;

    const {
      baseSalary = 0,
      allowances = [],
      deductions = [],
      terminalBenefits = []
    } = salaryRules;

    // ---------------- BUILD BREAKDOWN ----------------
    const breakdown = [];
    let totalAllowances = 0;
    let totalDeductions = 0;

    // Base Salary
    breakdown.push({
      name: "Base Salary",
      category: "base",
      value: Number(baseSalary),
      calculation: `Base Salary = ${Number(baseSalary)}`,
      excludeFromTotals: false,
    });

    // Allowances
    for (const a of allowances) {
      const calc =
        a.type === "percentage"
          ? Math.round((baseSalary * a.value) / 100)
          : Number(a.value);

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

    // Deductions
    for (const d of deductions) {
      const calc =
        d.type === "percentage"
          ? Math.round((baseSalary * d.value) / 100)
          : Number(d.value);

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

    // Terminal benefits (NOT included in totals)
    const terminalBenefitTotals = {};

    for (const t of terminalBenefits) {
      const calc =
        t.type === "percentage"
          ? Math.round((baseSalary * t.value) / 100)
          : Number(t.value);

      breakdown.push({
        name: t.name,
        category: "terminal",
        value: calc,
        calculation:
          t.type === "percentage"
            ? `${t.value}% of base = ${calc}`
            : `Fixed = ${calc}`,
        excludeFromTotals: true,
      });

      terminalBenefitTotals[t.name] =
        (terminalBenefitTotals[t.name] || 0) + calc;
    }

    // Net Salary
    const netSalary = Number(baseSalary) + totalAllowances - totalDeductions;

    breakdown.push({
      name: "Net Salary",
      category: "net",
      value: netSalary,
      calculation: `(Base + Allowances) - Deductions = ${netSalary}`,
      excludeFromTotals: false,
    });

    // ---------------- UPSERT for this specific month ----------------
    const paidFor = `${month} ${year}`;

    const loggedInEmployeeId = req.user?._id; 

    const breakupFile = await BreakupFile.findOneAndUpdate(
      { employeeId: empObjectId, month, year },
      {
        employeeId: empObjectId,
        roleId: roleObjectId,
        salaryRules,
        calculatedBreakup: {
          breakdown,
          totalAllowances,
          totalDeductions,
          netSalary,
        },
        month,
        year,
        paidFor,
        processedBy: loggedInEmployeeId,
      },
      { new: true, upsert: true }
    );

    // ---------------- RETURN ----------------
    return res.status(201).json({
      success: true,
      message: `Salary breakup for ${paidFor} created/updated`,
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
    const breakups = await BreakupFile.find({ employeeId })
      .populate("employeeId", "individualName personalEmail UserId")
      .populate("roleId", "roleName name")
      .sort({ createdAt: -1 });

    if (!breakups.length) {
      return res.status(404).json({
        success: false,
        message: "No salary history found",
      });
    }

    // Compile dashboard-friendly array
    const compiled = breakups.map((b) => {
      const paidDate = b.paidAt ? new Date(b.paidAt) : null;

      return {
        breakupId: b._id,

        // Basic
        month: b.month,
        year: b.year,
        paidFor: b.paidFor || `${b.month} ${b.year}`,

        // Salary calculations
        netSalary: b.calculatedBreakup.netSalary,
        totalAllowances: b.calculatedBreakup.totalAllowances,
        totalDeductions: b.calculatedBreakup.totalDeductions,

        // Payment information
        paymentStatus: b.paymentStatus,
        paidAt: b.paidAt,
        paidOnDate: paidDate ? paidDate.toDateString() : null,
        paidOnTime: paidDate ? paidDate.toLocaleTimeString() : null,

        // Timestamps
        createdAt: b.createdAt,
      };
    });

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

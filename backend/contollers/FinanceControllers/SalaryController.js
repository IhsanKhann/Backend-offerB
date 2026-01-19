import mongoose from "mongoose";
import RoleModel from "../../models/HRModals/Role.model.js"; // ✅ Changed from AllRolesModel
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";
import BreakupFile from "../../models/FinanceModals/SalaryBreakupModel.js";
import BreakupRulesModel from "../../models/FinanceModals/BreakupRules.js";
import RoleAssignmentModel from "../../models/HRModals/RoleAssignment.model.js"; // ✅ Added

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

    // ✅ Changed to RoleModel
    const role = await RoleModel.findOne({
      roleName: { $regex: new RegExp(`^${roleNameDecoded}$`, "i") },
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

    // ✅ Changed to RoleModel
    const role = await RoleModel.findOne({
      roleName: { $regex: new RegExp(`^${roleNameDecoded}$`, "i") },
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
      .populate("roleId", "roleName"); // ✅ Changed field name

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

// ✅ UPDATED: CREATE BREAKUP FILE
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

    // ✅ Changed to RoleModel
    const role = await RoleModel.findById(roleObjectId);
    if (!role)
      return res.status(404).json({ success: false, message: "Role declaration not found" });

    // Check existing breakup
    const existingBreakup = await BreakupFile.findOne({ 
      employeeId: empObjectId, 
      month, 
      year 
    });

    if (existingBreakup) {
      if (existingBreakup.paidAt) {
        return res.status(400).json({
          success: false,
          message: `Salary for ${month} ${year} has already been paid`,
          month,
          status: "paid",
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `Salary breakup for ${month} ${year} is already created and in processing`,
          month,
          status: "processing",
        });
      }
    }

    // Get salary rules from role declaration
    const salaryRules = role.salaryRules;
    const { 
      baseSalary = 0, 
      allowances = [], 
      deductions = [], 
      terminalBenefits = [] 
    } = salaryRules;

    // Build breakdown
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
      const calc = a.type === "percentage" 
        ? Math.round((baseSalary * a.value) / 100) 
        : Number(a.value);
      breakdown.push({
        name: a.name,
        category: "allowance",
        value: calc,
        calculation: a.type === "percentage" 
          ? `${a.value}% of base = ${calc}` 
          : `Fixed = ${calc}`,
        excludeFromTotals: false,
      });
      totalAllowances += calc;
    }

    // Deductions
    for (const d of deductions) {
      const calc = d.type === "percentage" 
        ? Math.round((baseSalary * d.value) / 100) 
        : Number(d.value);
      breakdown.push({
        name: d.name,
        category: "deduction",
        value: calc,
        calculation: d.type === "percentage" 
          ? `${d.value}% of base = ${calc}` 
          : `Fixed = ${calc}`,
        excludeFromTotals: false,
      });
      totalDeductions += calc;
    }

    // Terminal benefits (NOT included in totals)
    for (const t of terminalBenefits) {
      const calc = t.type === "percentage" 
        ? Math.round((baseSalary * t.value) / 100) 
        : Number(t.value);
      breakdown.push({
        name: t.name,
        category: "terminal",
        value: calc,
        calculation: t.type === "percentage" 
          ? `${t.value}% of base = ${calc}` 
          : `Fixed = ${calc}`,
        excludeFromTotals: true,
      });
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

    // Create breakup file
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

    return res.status(201).json({
      success: true,
      message: `Salary breakup for ${paidFor} created successfully`,
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

// ✅ UPDATED: GET EMPLOYEE SALARY HISTORY
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
      .populate("roleId", "roleName") // ✅ Changed field name
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
        month: b.month,
        year: b.year,
        paidFor: b.paidFor || `${b.month} ${b.year}`,
        netSalary: b.calculatedBreakup.netSalary,
        totalAllowances: b.calculatedBreakup.totalAllowances,
        totalDeductions: b.calculatedBreakup.totalDeductions,
        paymentStatus: b.paymentStatus,
        paidAt: b.paidAt,
        paidOnDate: paidDate ? paidDate.toDateString() : null,
        paidOnTime: paidDate ? paidDate.toLocaleTimeString() : null,
        createdAt: b.createdAt,
        salaryRules: b.salaryRules, // ✅ Include full salary rules
        calculatedBreakup: b.calculatedBreakup, // ✅ Include breakdown
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

// DELETE SALARY BREAKUP
export const deleteBreakup = async (req, res) => {
  const { breakupId } = req.params;

  if (!breakupId) {
    return res.status(400).json({ 
      success: false, 
      message: "Breakup ID is required" 
    });
  }

  try {
    const deleted = await BreakupFile.findByIdAndDelete(breakupId);

    if (!deleted) {
      return res.status(404).json({ 
        success: false, 
        message: "Breakup not found" 
      });
    }

    return res.json({ 
      success: true, 
      message: "Breakup deleted successfully" 
    });
  } catch (err) {
    console.error("Error deleting breakup:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};
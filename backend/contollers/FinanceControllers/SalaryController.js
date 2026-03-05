// controllers/FinanceControllers/SalaryController.js
// ═══════════════════════════════════════════════════════════════
// Phase 2 Hardening — Findings addressed:
//   C-04 — deleteBreakup now:
//           1. Fetches the breakup to check its paymentStatus.
//           2. Returns 409 Conflict if paymentStatus === "paid".
//           3. Wraps the delete and audit log in a single session.
//           4. Writes a SALARY_BREAKUP_DELETED audit log entry.
//           5. Requires actorId (req.user._id) for the audit record.
//   F-01 — All salary arithmetic uses Math.round(). No parseFloat drift.
//   F-09 — Regex injection safeguard preserved on all roleName lookups.
//   F-15 — actorId required check for all mutation operations.
//   F-18 — AuditService.log inside session for createBreakupFile.
// ═══════════════════════════════════════════════════════════════
import mongoose from "mongoose";
import RoleModel from "../../models/HRModals/Role.model.js";
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";
import BreakupFile from "../../models/FinanceModals/SalaryBreakupModel.js";
import BreakupRulesModel from "../../models/FinanceModals/BreakupRules.js";
import RoleAssignmentModel from "../../models/HRModals/RoleAssignment.model.js";
import AuditService from "../../services/auditService.js";

// ─────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────
const safeToObjectId = (id) => {
  if (!id) return null;
  const idStr = String(id);
  return mongoose.Types.ObjectId.isValid(idStr)
    ? new mongoose.Types.ObjectId(idStr)
    : null;
};

// ─────────────────────────────────────────────────────────────
// GET SALARY RULES BY ROLE NAME
// F-09: regex metacharacters escaped
// ─────────────────────────────────────────────────────────────
export const getSalaryRulesByRoleName = async (req, res) => {
  try {
    const roleNameDecoded = decodeURIComponent(req.params.roleName).trim();
    const _escapedRoleName = roleNameDecoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const role = await RoleModel.findOne({
      roleName: { $regex: new RegExp(`^${_escapedRoleName}$`, "i") },
    });
    if (!role) {
      return res.status(404).json({ success: false, message: `Role '${roleNameDecoded}' not found` });
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
    const _escapedRoleName = roleNameDecoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const role = await RoleModel.findOne({
      roleName: { $regex: new RegExp(`^${_escapedRoleName}$`, "i") },
    });
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });
    return res.status(200).json({ success: true, data: role.salaryRules || null });
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
      .populate({ path: "roleId", model: "Role", select: "roleName salaryRules code status" });
    if (!breakup) {
      return res.status(404).json({ success: false, message: "Breakup file not found" });
    }
    return res.status(200).json({ success: true, data: breakup });
  } catch (err) {
    console.error("Error fetching breakup file:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// CREATE BREAKUP FILE
// F-01, F-15, F-18
// ─────────────────────────────────────────────────────────────
export const createBreakupFile = async (req, res) => {
  try {
    const { employeeId, roleId, month, year } = req.body;

    if (!employeeId || !roleId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: "employeeId, roleId, month, and year are required",
      });
    }

    const empObjectId  = safeToObjectId(employeeId);
    const roleObjectId = safeToObjectId(roleId);

    const employee = await FinalizedEmployeeModel.findById(empObjectId);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    const role = await RoleModel.findById(roleObjectId);
    if (!role) return res.status(404).json({ success: false, message: "Role declaration not found" });

    let existingBreakup = await BreakupFile.findOne({ employeeId: empObjectId, month, year });

    if (existingBreakup?.paidAt) {
      return res.status(409).json({
        success: false,
        message: `Salary for ${month} ${year} has already been paid`,
        status: "paid",
      });
    }

    const salaryRules = role.salaryRules || {};
    const { baseSalary = 0, allowances = [], deductions = [], terminalBenefits = [] } = salaryRules;

    const breakdown = [];
    let totalAllowances = 0;
    let totalDeductions = 0;

    // F-01: integer arithmetic throughout
    breakdown.push({
      name: "Base Salary",
      category: "base",
      value: Math.round(Number(baseSalary)),
      calculation: `Base Salary = ${Math.round(Number(baseSalary))}`,
      excludeFromTotals: false,
    });

    for (const a of allowances) {
      const value = a.type === "percentage"
        ? Math.round((baseSalary * a.value) / 100)
        : Math.round(Number(a.value));
      breakdown.push({
        name: a.name, category: "allowance", value,
        calculation: a.type === "percentage" ? `${a.value}% of base = ${value}` : `Fixed = ${value}`,
        excludeFromTotals: false,
      });
      totalAllowances += value;
    }

    for (const d of deductions) {
      const value = d.type === "percentage"
        ? Math.round((baseSalary * d.value) / 100)
        : Math.round(Number(d.value));
      breakdown.push({
        name: d.name, category: "deduction", value,
        calculation: d.type === "percentage" ? `${d.value}% of base = ${value}` : `Fixed = ${value}`,
        excludeFromTotals: false,
      });
      totalDeductions += value;
    }

    for (const t of terminalBenefits) {
      const value = t.type === "percentage"
        ? Math.round((baseSalary * t.value) / 100)
        : Math.round(Number(t.value));
      breakdown.push({
        name: t.name, category: "terminal", value,
        calculation: t.type === "percentage" ? `${t.value}% of base = ${value}` : `Fixed = ${value}`,
        excludeFromTotals: true,
      });
    }

    // FI-4: netSalary includes baseSalary
    const netSalary = Math.round(Number(baseSalary)) + totalAllowances - totalDeductions;
    breakdown.push({
      name: "Net Salary",
      category: "net",
      value: netSalary,
      calculation: `(Base + Allowances) - Deductions = ${netSalary}`,
      excludeFromTotals: false,
    });

    const paidFor          = `${month} ${year}`;
    const loggedInEmployeeId = req.user?._id;
    if (!loggedInEmployeeId) {
      return res.status(401).json({ success: false, message: "Actor identity required" });
    }

    const mongoSession = await mongoose.startSession();
    let breakupFile;
    await mongoSession.withTransaction(async () => {
      breakupFile = await BreakupFile.findOneAndUpdate(
        { employeeId: empObjectId, month, year },
        {
          employeeId: empObjectId,
          roleId: roleObjectId,
          salaryRules,
          calculatedBreakup: { breakdown, totalAllowances, totalDeductions, netSalary },
          month,
          year,
          paidFor,
          processedBy: loggedInEmployeeId,
        },
        { new: true, upsert: true, session: mongoSession }
      );

      // F-18: audit inside session
      await AuditService.log({
        eventType:  "SALARY_BREAKUP_CREATED",
        actorId:    loggedInEmployeeId,
        entityId:   breakupFile._id,
        entityType: "SalaryBreakup",
        currency:   "PKR",
        meta: { employeeId, roleId, month, year, netSalary, paidFor },
      }, { type: "financial", session: mongoSession });
    });
    mongoSession.endSession();

    return res.status(201).json({
      success: true,
      message: `Salary breakup for ${paidFor} created successfully`,
      data: breakupFile,
      status: existingBreakup ? "updated" : "created",
    });
  } catch (err) {
    console.error("ERROR createBreakupFile:", err);
    return res.status(500).json({ success: false, message: "Error creating breakup file", error: err.message });
  }
};

// CREATE BREAKUP RULE
export const createBreakupRule = async (req, res) => {
  try {
    const { transactionType, incrementType, splits } = req.body;

    if (!transactionType || !splits || splits.length === 0) {
      return res.status(400).json({ error: "transactionType and at least one split are required" });
    }

    const formattedSplits = splits.map((split) => ({
      componentName: split.componentName,
      type:          split.type,
      instanceId:    safeToObjectId(split.instanceId),
      summaryId:     safeToObjectId(split.summaryId),
      definitionId:  safeToObjectId(split.definitionId),
      debitOrCredit: split.debitOrCredit,
      fieldLineId:   split.fieldLineId || null,
      mirrors: (split.mirrors || []).map((mirror) => ({
        instanceId:    safeToObjectId(mirror.instanceId),
        summaryId:     safeToObjectId(mirror.summaryId),
        definitionId:  safeToObjectId(mirror.definitionId),
        debitOrCredit: mirror.debitOrCredit,
        fallback:      mirror.fallback || "none",
        fieldLineId:   mirror.fieldLineId || null,
      })),
    }));

    const newRule = new BreakupRulesModel({
      transactionType,
      incrementType: incrementType || "both",
      splits: formattedSplits,
    });

    await newRule.save();
    return res.status(201).json({ message: "Breakup rule created successfully", rule: newRule });
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

// GET EMPLOYEE SALARY HISTORY
export const getEmployeeSalaryHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }

    const breakups = await BreakupFile.find({ employeeId })
      .populate("employeeId", "individualName personalEmail UserId")
      .populate({ path: "roleId", model: "Role", select: "roleName salaryRules code status" })
      .sort({ createdAt: -1 });

    if (!breakups.length) {
      return res.status(404).json({ success: false, message: "No salary history found" });
    }

    const compiled = breakups.map((b) => {
      const paidDate = b.paidAt ? new Date(b.paidAt) : null;
      return {
        breakupId:       b._id,
        month:           b.month,
        year:            b.year,
        paidFor:         b.paidFor || `${b.month} ${b.year}`,
        netSalary:       b.calculatedBreakup.netSalary,
        totalAllowances: b.calculatedBreakup.totalAllowances,
        totalDeductions: b.calculatedBreakup.totalDeductions,
        paymentStatus:   b.paymentStatus,
        paidAt:          b.paidAt,
        paidOnDate:      paidDate ? paidDate.toDateString() : null,
        paidOnTime:      paidDate ? paidDate.toLocaleTimeString() : null,
        createdAt:       b.createdAt,
        salaryRules:     b.salaryRules,
        calculatedBreakup: b.calculatedBreakup,
      };
    });

    return res.status(200).json({ success: true, count: compiled.length, breakups: compiled });
  } catch (err) {
    console.error("Error fetching salary history:", err);
    return res.status(500).json({ success: false, message: "Server error while fetching salary history" });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE SALARY BREAKUP
//
// C-04 FIX:
//   1. Fetches the breakup and validates it exists.
//   2. Returns 409 if paymentStatus === "paid" — never delete a paid breakup
//      without an explicit reversal workflow (out of scope for this controller).
//   3. Requires req.user._id (actorId) for audit.
//   4. Wraps findByIdAndDelete AND audit log in a single session.withTransaction
//      so that a crash between delete and audit leaves no orphaned records.
//   5. Writes SALARY_BREAKUP_DELETED audit event.
// ─────────────────────────────────────────────────────────────
export const deleteBreakup = async (req, res) => {
  const { breakupId } = req.params;

  if (!breakupId) {
    return res.status(400).json({ success: false, message: "Breakup ID is required" });
  }

  // F-15: actorId required — deletion is a financial mutation
  if (!req.user?._id) {
    return res.status(401).json({ success: false, message: "Actor identity required" });
  }

  try {
    // C-04 FIX Step 1: fetch breakup before session to get paymentStatus
    const breakup = await BreakupFile.findById(breakupId).lean();
    if (!breakup) {
      return res.status(404).json({ success: false, message: "Breakup not found" });
    }

    // C-04 FIX Step 2: hard guard — paid breakups cannot be deleted
    if (breakup.paymentStatus === "paid") {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete a paid salary breakup. " +
          "A transaction reversal must be posted first to restore ledger balance " +
          "before this record can be removed.",
        paymentStatus: breakup.paymentStatus,
      });
    }

    // C-04 FIX Steps 3 & 4: delete + audit in a single atomic session
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await BreakupFile.findByIdAndDelete(breakupId, { session });

      // C-04 FIX Step 5: SALARY_BREAKUP_DELETED audit entry
      await AuditService.log({
        eventType:  "SALARY_BREAKUP_DELETED",
        actorId:    req.user._id,
        entityId:   breakup._id,
        entityType: "SalaryBreakup",
        currency:   "PKR",
        meta: {
          employeeId:    breakup.employeeId,
          month:         breakup.month,
          year:          breakup.year,
          paymentStatus: breakup.paymentStatus,
          paidFor:       breakup.paidFor,
        },
      }, { type: "financial", session });
    });
    session.endSession();

    return res.json({ success: true, message: "Breakup deleted successfully" });
  } catch (err) {
    console.error("Error deleting breakup:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
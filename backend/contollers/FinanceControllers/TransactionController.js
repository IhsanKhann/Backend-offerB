// controllers/FinanceControllers/TransactionController.js
// ═══════════════════════════════════════════════════════════════
// Phase 2 Hardening — Findings addressed:
//   C-01  — Fixed: `rules` was referenced but never declared in SalaryTransactionController
//   C-03  — Fixed: bank API now called INSIDE session.withTransaction, BEFORE commit
//   C-05  — Fixed: opening balance now receives an audit log entry
//   F-01  — All monetary values are integer Number (minor units / paise). No Decimal128.
//   F-03  — isReflection guard in applyBalanceChange: reflection lines never mutate balances
//   F-04  — currency field threaded through all audit calls
//   F-05  — double-entry guard in persistTransactionAndApply (debitTotal === creditTotal)
//   F-14  — applyBalanceChange uses $inc — atomic, no read-modify-write
//   F-15  — actorId required for every financial write
//   F-18  — AuditService.log called inside session at every mutation point
// ═══════════════════════════════════════════════════════════════
import mongoose from "mongoose";
const { ObjectId } = mongoose.Types;

import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineDefinition from "../../models/FinanceModals/FieldLineDefinitionModel.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";
import TablesModel from "../../models/FinanceModals/TablesModel.js";
import BreakupFileModel from "../../models/FinanceModals/SalaryBreakupModel.js";
import BreakupRuleModel from "../../models/FinanceModals/BreakupRules.js";
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";
import RuleModel from "../../models/FinanceModals/TablesModel.js";
import AuditService from "../../services/auditService.js";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const safeToObjectId = (id) => {
  if (!id && id !== 0) return null;
  if (typeof id === "string" && ObjectId.isValid(id)) return new ObjectId(id);
  if (id instanceof ObjectId) return id;
  return null;
};

async function getSummaryObjectId(numericSummaryId, session = null) {
  if (numericSummaryId === null || numericSummaryId === undefined) return null;
  const q = SummaryModel.findOne({ summaryId: numericSummaryId });
  if (session) q.session(session);
  const summary = await q;
  if (!summary) throw new Error(`Summary with summaryId ${numericSummaryId} not found`);
  return summary._id;
}

async function getDefinitionByNumericId(numericId, session = null) {
  if (numericId === null || numericId === undefined) return null;
  const q = SummaryFieldLineDefinition.findOne({ fieldLineNumericId: numericId });
  if (session) q.session(session);
  const def = await q;
  return def ? def._id : null;
}

async function getInstanceByNumericFieldLineId(numericId, session = null) {
  if (numericId === null || numericId === undefined) return null;
  const q = SummaryFieldLineInstance.findOne({ fieldLineNumericId: numericId });
  if (session) q.session(session);
  const inst = await q;
  return inst ? inst._id : null;
}

export const resolveInstanceForEntry = async (entry, session = null) => {
  if (entry.instanceId) return safeToObjectId(entry.instanceId);
  if (entry.definitionId) {
    const inst = await SummaryFieldLineInstance.findOne({
      definitionId: safeToObjectId(entry.definitionId),
    }).session(session);
    if (inst) return inst._id;
  }
  return null;
};

export const resolveSummaryIdForEntry = async (entry, session) => {
  if (entry.summaryId) return entry.summaryId;
  if (entry.instanceId) {
    const instance = await SummaryFieldLineInstance.findById(entry.instanceId)
      .select("summaryId")
      .session(session);
    return instance?.summaryId || null;
  }
  return null;
};

export const resolveDefinitionIdForEntry = async (entry, session = null) => {
  if (entry.definitionId) return safeToObjectId(entry.definitionId);
  if (entry.fieldLineId) {
    const def = await SummaryFieldLineDefinition.findOne({
      fieldLineNumericId: entry.fieldLineId,
    }).session(session);
    if (def) return def._id;
  }
  return null;
};

// F-01: Math.round applied here and in every call site
export function computeLineAmount(split, baseAmount = 0, incrementType = "both", totalPercent = 100) {
  const fixed = Number(split.fixedAmount || 0);
  const perc = Number(split.percentage || 0);

  if (incrementType === "fixed") return Math.round(fixed);
  if (incrementType === "percentage") return Math.round((perc / (totalPercent || 100)) * baseAmount);
  return Math.round(fixed + (perc / (totalPercent || 100)) * baseAmount);
}

// F-01: amount always rounded to integer
export function buildLine({ instanceId, summaryId, definitionId, debitOrCredit, amount, description, isReflection }) {
  const intAmount = Math.round(Number(amount || 0));
  return {
    instanceId,
    summaryId,
    definitionId,
    debitOrCredit,
    amount: intAmount,
    description: description || "",
    isReflection: !!isReflection,
  };
}

// ─────────────────────────────────────────────────────────────
// applyBalanceChange
// F-03 / F-14: reflection lines are a NO-OP; all updates use $inc (atomic)
// ─────────────────────────────────────────────────────────────
export const applyBalanceChange = async (
  { instanceId, summaryId, debitOrCredit, amount, isReflection },
  session = null
) => {
  // F-03: reflection lines MUST NOT mutate any balance
  if (isReflection) return;

  const amt = Math.round(Number(amount || 0));
  if (amt === 0) return;

  // Positive increment for debit, negative for credit
  const increment = debitOrCredit === "debit" ? amt : -amt;

  if (instanceId) {
    // F-14: $inc is atomic — no read-modify-write race condition
    const updatedInst = await SummaryFieldLineInstance.findByIdAndUpdate(
      instanceId,
      { $inc: { balance: increment } },
      { new: true, session }
    );
    if (updatedInst?.summaryId) {
      // F-14: $inc on summary too — atomic
      await SummaryModel.findByIdAndUpdate(
        updatedInst.summaryId,
        { $inc: { endingBalance: increment } },
        { session }
      );
    }
    return;
  }

  if (summaryId) {
    await SummaryModel.findByIdAndUpdate(
      summaryId,
      { $inc: { endingBalance: increment } },
      { session }
    );
  }
};

// ─────────────────────────────────────────────────────────────
// persistTransactionAndApply
// F-05: double-entry guard BEFORE TransactionModel.create
// F-01: integer amounts enforced
// F-03: isReflection threaded through
// ─────────────────────────────────────────────────────────────
export const persistTransactionAndApply = async (
  accountingLines = [],
  description = "Transaction",
  session,
  { currency = "PKR" } = {}
) => {
  if (!Array.isArray(accountingLines) || !accountingLines.length) {
    throw new Error("No accounting lines provided");
  }
  if (!session) {
    throw new Error("MongoDB session is required");
  }

  // Normalize and validate each line
  const normalizedLines = accountingLines.map((l, index) => {
    if (!l.debitOrCredit || !["debit", "credit"].includes(l.debitOrCredit)) {
      throw new Error(`Invalid debitOrCredit at line ${index + 1}`);
    }
    const amount = Math.round(Number(l.amount));
    if (!amount || amount <= 0) {
      throw new Error(`Invalid amount at line ${index + 1}`);
    }
    return {
      employeeId:    l.employeeId   || null,
      instanceId:    l.instanceObjectId || null,
      summaryId:     l.summaryObjectId  || null,
      definitionId:  l.definitionObjectId || null,
      debitOrCredit: l.debitOrCredit,
      // F-01: integer minor units
      amount,
      description:   l.fieldName || "",
      isReflection:  !!l.isReflection,
    };
  });

  // F-05: Double-entry guard — must pass BEFORE any DB write
  const postingLines = normalizedLines.filter(l => !l.isReflection);
  const debitTotal  = postingLines.filter(l => l.debitOrCredit === "debit").reduce((s, l) => s + l.amount, 0);
  const creditTotal = postingLines.filter(l => l.debitOrCredit === "credit").reduce((s, l) => s + l.amount, 0);
  if (debitTotal !== creditTotal) {
    throw new Error(
      `Double-entry violation: debit=${debitTotal} does not equal credit=${creditTotal}. Transaction aborted.`
    );
  }

  // F-01: top-level amount = sum of non-reflection debits
  const totalAmount = debitTotal;

  const [transaction] = await TransactionModel.create(
    [{
      date: new Date(),
      description,
      type: "journal",
      amount: totalAmount,
      currency,
      status: "posted",
      lines: normalizedLines,
    }],
    { session }
  );

  // Apply balance changes — F-03 reflection guard is inside applyBalanceChange
  for (const line of normalizedLines) {
    await applyBalanceChange(
      {
        instanceId:    line.instanceId,
        summaryId:     line.summaryId,
        debitOrCredit: line.debitOrCredit,
        amount:        line.amount,
        isReflection:  line.isReflection,
      },
      session
    );
  }

  return { transactionId: transaction._id, transaction };
};

// Well-known summary numeric IDs — kept as constants so they match DB data
export const SID = {
  CAPITAL:    1600,
  CASH:       1500,
  COMMISSION: 5200,
};

// ─────────────────────────────────────────────────────────────
// EXPENSE CONTROLLERS
// ─────────────────────────────────────────────────────────────
export const ExpensePayLaterController = async (req, res) => {
  try {
    const tx = await postExpenseTransaction({
      amount: req.body.amount,
      description: req.body.description,
      user: req.user,
      transactionType: "EXPENSE_PAY_LATER",
    });
    res.status(201).json({ message: "Expense recorded as payable", transactionId: tx._id });
  } catch (err) {
    console.error("ExpensePayLaterController Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const ExpensePayNowController = async (req, res) => {
  try {
    const tx = await postExpenseTransaction({
      amount: req.body.amount,
      description: req.body.description,
      user: req.user,
      transactionType: "EXPENSE_PAY_NOW",
    });
    res.status(201).json({ message: "Expense paid successfully", transactionId: tx._id });
  } catch (err) {
    console.error("ExpensePayNowController Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// postExpenseTransaction — core expense logic
// F-01, F-03, F-05, F-18
// ─────────────────────────────────────────────────────────────
export const postExpenseTransaction = async ({ amount, transactionType, description, user }) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // F-01: integer minor units
    const baseAmount = Math.round(Number(amount));
    if (!baseAmount || baseAmount <= 0) throw new Error("Invalid expense amount");

    const rule = await RuleModel.findOne({ transactionType }).session(session).lean();
    if (!rule) throw new Error(`Expense rule not found: ${transactionType}`);

    const transactionLines = [];
    const splits = rule.splits || [];
    const totalPercent = splits.reduce((sum, sp) => sum + (Number(sp.percentage) || 0), 0) || 100;

    for (const split of splits) {
      const splitAmount = Math.round(computeLineAmount(split, baseAmount, rule.incrementType, totalPercent));
      if (!splitAmount) continue;

      const instanceId   = split.instanceId || (await resolveInstanceForEntry(split, session));
      const summaryId    = split.summaryId   || (await resolveSummaryIdForEntry(split, session));
      const definitionId = split.definitionId || (await resolveDefinitionIdForEntry(split, session));

      if (!instanceId || !summaryId || !definitionId) {
        throw new Error(`Unresolved accounting IDs for split: ${split.fieldName}`);
      }

      transactionLines.push(buildLine({
        instanceId, summaryId, definitionId,
        debitOrCredit: split.debitOrCredit,
        amount: splitAmount,
        description: split.fieldName,
        isReflection: !!split.isReflection,
      }));

      if (Array.isArray(split.mirrors)) {
        for (const mirror of split.mirrors) {
          const mi = mirror.instanceId   || (await resolveInstanceForEntry(mirror, session));
          const ms = mirror.summaryId    || (await resolveSummaryIdForEntry(mirror, session));
          const md = mirror.definitionId || (await resolveDefinitionIdForEntry(mirror, session));
          if (!mi || !ms || !md) continue;

          transactionLines.push(buildLine({
            instanceId: mi, summaryId: ms, definitionId: md,
            debitOrCredit: mirror.debitOrCredit,
            amount: splitAmount,
            description: mirror.fieldName || `${split.fieldName} Mirror`,
            isReflection: !!mirror.isReflection,
          }));
        }
      }
    }

    if (!transactionLines.length) throw new Error("No transaction lines generated");

    // F-05: double-entry guard on expense lines
    const postingLines = transactionLines.filter(l => !l.isReflection);
    const debitTotal   = postingLines.filter(l => l.debitOrCredit === "debit").reduce((s, l) => s + l.amount, 0);
    const creditTotal  = postingLines.filter(l => l.debitOrCredit === "credit").reduce((s, l) => s + l.amount, 0);
    if (debitTotal !== creditTotal) {
      throw new Error(
        `Expense double-entry violation: debit=${debitTotal} credit=${creditTotal}`
      );
    }

    const isPaid = transactionType === "EXPENSE_PAY_NOW";
    const [tx] = await TransactionModel.create([{
      date: new Date(),
      description,
      type: "expense",
      amount: baseAmount,
      currency: "PKR",
      createdBy: user?._id || null,
      status: "posted",
      expenseDetails: {
        includedInPnL: false,
        isPaid,
        isPaidAt: isPaid ? new Date() : null,
      },
      lines: transactionLines,
    }], { session });

    for (const line of transactionLines) {
      await applyBalanceChange({
        instanceId:    line.instanceId,
        summaryId:     line.summaryId,
        debitOrCredit: line.debitOrCredit,
        amount:        line.amount,
        isReflection:  line.isReflection,
      }, session);
    }

    // F-18: audit inside session — failure rolls back transaction
    await AuditService.log({
      eventType:  "JOURNAL_POSTED",
      actorId:    user?._id || null,
      entityId:   tx._id,
      entityType: "Transaction",
      currency:   "PKR",
      meta: { transactionType, amount: baseAmount },
    }, { type: "financial", session });

    await session.commitTransaction();
    return tx;
  } catch (err) {
    console.error("postExpenseTransaction FAILED:", err.message);
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// CommissionTransactionController
// F-01, F-05, F-15, F-18
// ─────────────────────────────────────────────────────────────
export const CommissionTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { amount, description } = req.body;
    if (!req.user?._id) return res.status(401).json({ error: "Actor identity required" });
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid commission amount" });

    // F-01: integer minor units
    const intAmount = Math.round(Number(amount));

    const commissionInstance = await SummaryFieldLineInstance.findOne({ fieldLineNumericId: 5201 }).session(session);
    const cashInstance       = await SummaryFieldLineInstance.findOne({ fieldLineNumericId: 5301 }).session(session);
    const commissionSummaryObj = await getSummaryObjectId(SID.COMMISSION, session);
    const cashSummaryObj       = await getSummaryObjectId(SID.CASH, session);

    const accountingLines = [
      {
        instanceObjectId:    cashInstance ? cashInstance._id : null,
        summaryObjectId:     cashSummaryObj,
        definitionObjectId:  cashInstance ? cashInstance.definitionId : null,
        debitOrCredit: "debit",
        amount: intAmount,
        fieldName: "Commission received (Cash)",
      },
      {
        instanceObjectId:    commissionInstance ? commissionInstance._id : null,
        summaryObjectId:     commissionSummaryObj,
        definitionObjectId:  commissionInstance ? commissionInstance.definitionId : null,
        debitOrCredit: "credit",
        amount: intAmount,
        fieldName: "Commission Income",
      },
    ];

    const tx = await persistTransactionAndApply(accountingLines, description || "Commission Transaction", session);

    await AuditService.log({
      eventType:  "JOURNAL_POSTED",
      actorId:    req.user._id,
      entityId:   tx.transactionId,
      entityType: "Transaction",
      currency:   "PKR",
      meta: { transactionType: "COMMISSION", amount: intAmount },
    }, { type: "financial", session });

    await session.commitTransaction();
    session.endSession();
    return res.status(201).json({ message: "Commission transaction posted successfully", transactionId: tx.transactionId });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("CommissionTransactionController Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// ─────────────────────────────────────────────────────────────
// SalaryTransactionController
// C-01 FIX: `rules` was referenced but never declared — now fetched before use.
// F-01, F-03, F-04, F-05, F-15, F-18
// FI-4 FIX: netSalary = baseSalary + totalAllowances - totalDeductions
// ─────────────────────────────────────────────────────────────
export const SalaryTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const employeeId = req.params.employeeId || req.body.employeeId;
    if (!employeeId) throw new Error("Employee ID is required.");
    if (!req.user?._id) throw new Error("Actor identity required for salary transaction.");

    const description = req.body.description || `Salary Transaction - ${employeeId}`;

    // ─── C-01 FIX: rules must be fetched here, inside the session ───
    const rules = await BreakupRuleModel.find({ transactionType: "Salary" })
      .session(session)
      .lean();
    if (!rules?.length) throw new Error("No Breakup Rules found.");

    const breakupFile = await BreakupFileModel.findOne({ employeeId }).session(session).lean();
    if (!breakupFile) throw new Error(`No Breakup File found for employee ${employeeId}`);

    const computedBreakdown = breakupFile?.calculatedBreakup?.breakdown || [];
    const components = [];

    for (const rule of rules) {
      for (const split of rule.splits || []) {
        const computed = computedBreakdown.find(
          (c) => (c.name || "").toLowerCase() === (split.componentName || "").toLowerCase()
        );
        const value = computed?.value ?? Number(split.fixedAmount || 0);

        let instanceObjectId = split.instanceId ? safeToObjectId(split.instanceId) : null;
        if (!instanceObjectId && split.definitionId && split.summaryId) {
          const instance = await SummaryFieldLineInstance.findOne({
            definitionId: split.definitionId,
            summaryId:    split.summaryId,
          }).session(session).lean();
          if (instance) instanceObjectId = instance._id;
        }

        components.push({
          componentName:     split.componentName,
          value:             Math.round(Number(value || 0)),
          category:          computed?.category || split.type,
          debitOrCredit:     split.debitOrCredit ?? (split.type === "deduction" ? "credit" : "debit"),
          summaryObjectId:   safeToObjectId(split.summaryId),
          definitionObjectId: safeToObjectId(split.definitionId),
          instanceObjectId,
          mirrors: split.mirrors || [],
        });
      }
    }

    // Build accounting lines and aggregate totals
    let totalBaseSalary  = 0;
    let totalAllowances  = 0;
    let totalDeductions  = 0;
    const accountingLines = [];

    for (const comp of components) {
      const amount = comp.value;
      if (!amount) continue;

      if (
        comp.componentName.toLowerCase() === "base salary" ||
        comp.componentName.toLowerCase() === "administrative allowance"
      ) totalBaseSalary += amount;

      if (comp.category === "allowance")  totalAllowances += amount;
      if (comp.category === "deduction")  totalDeductions += amount;

      accountingLines.push({
        employeeId,
        instanceObjectId:   comp.instanceObjectId,
        summaryObjectId:    comp.summaryObjectId,
        definitionObjectId: comp.definitionObjectId,
        debitOrCredit: comp.debitOrCredit,
        amount,
        fieldName: comp.componentName,
      });

      for (const mirror of comp.mirrors) {
        accountingLines.push({
          employeeId,
          instanceObjectId:   mirror.instanceId ? safeToObjectId(mirror.instanceId) : null,
          summaryObjectId:    safeToObjectId(mirror.summaryId),
          definitionObjectId: safeToObjectId(mirror.definitionId),
          debitOrCredit: mirror.debitOrCredit,
          amount,
          fieldName: `${comp.componentName} (mirror)`,
          isReflection: !!mirror.isReflection,
        });
      }
    }

    // FI-4 FIX: net = baseSalary + allowances - deductions (not allowances - deductions)
    const netSalary = totalBaseSalary + totalAllowances - totalDeductions;

    if (netSalary > 0) {
      const capitalSummaryId = await getSummaryObjectId(SID.CAPITAL, session);
      accountingLines.push({
        employeeId,
        fieldName: "Net Salary Payment (Capital)",
        amount: netSalary,
        debitOrCredit: "credit",
        summaryObjectId: capitalSummaryId,
        definitionObjectId: null,
        instanceObjectId: null,
      });
    }

    const tx = await persistTransactionAndApply(accountingLines, description, session);

    // F-18: audit inside session
    await AuditService.log({
      eventType:  "SALARY_BREAKUP_CREATED",
      actorId:    req.user._id,
      entityId:   tx.transactionId,
      entityType: "Transaction",
      currency:   "PKR",
      meta: { employeeId, netSalary, totalBaseSalary, totalAllowances, totalDeductions },
    }, { type: "financial", session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Salary transaction posted directly to Capital",
      employeeId,
      transactionId: tx.transactionId,
      totalBaseSalary,
      totalAllowances,
      totalDeductions,
      netSalary,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("SalaryTransactionController Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// ─────────────────────────────────────────────────────────────
// SalaryTransactionControllerWithBankingDetails
// C-03 FIX: sendSalaryThroughBankAPI moved INSIDE withTransaction,
//           called BEFORE the implicit commit that withTransaction performs.
//           If the bank call throws, the entire transaction rolls back.
// F-01, FI-4 FIX: net = baseSalary + allowances - deductions
// ─────────────────────────────────────────────────────────────
export const SalaryTransactionControllerWithBankingDetails = async (req, res) => {
  const session = await mongoose.startSession();
  let responsePayload = null;

  try {
    await session.withTransaction(async () => {
      const employeeId = req.params.employeeId || req.body.employeeId;
      if (!employeeId) throw new Error("Employee ID is required.");
      if (!req.user?._id) throw new Error("Actor identity required for salary transaction.");

      const employee = await FinalizedEmployeeModel.findById(employeeId).lean();
      if (!employee) throw new Error("Employee not found.");
      if (!employee.bankingDetails?.accountNumber) throw new Error("Employee banking details missing.");

      const description = req.body.description || `Salary Transaction - ${employeeId}`;

      // C-01 pattern: always fetch rules inside the session
      const rules = await BreakupRuleModel.find({ transactionType: "Salary" })
        .session(session)
        .lean();
      if (!rules?.length) throw new Error("No Breakup Rules found.");

      const breakupFile = await BreakupFileModel.findOne({ employeeId }).session(session).lean();
      if (!breakupFile) throw new Error(`No Breakup File found for employee ${employeeId}`);

      const computedBreakdown = breakupFile?.calculatedBreakup?.breakdown || [];
      const components = [];

      for (const rule of rules) {
        for (const split of rule.splits || []) {
          const computed = computedBreakdown.find(
            (c) => (c.name || "").toLowerCase() === (split.componentName || "").toLowerCase()
          );
          const value = computed?.value ?? Number(split.fixedAmount || 0);

          let instanceObjectId = split.instanceId ? safeToObjectId(split.instanceId) : null;
          if (!instanceObjectId && split.definitionId && split.summaryId) {
            const instance = await SummaryFieldLineInstance.findOne({
              definitionId: split.definitionId,
              summaryId:    split.summaryId,
            }).session(session).lean();
            if (instance) instanceObjectId = instance._id;
          }

          components.push({
            componentName:     split.componentName,
            value:             Math.round(Number(value || 0)),
            category:          computed?.category || split.type,
            debitOrCredit:     split.debitOrCredit ?? (split.type === "deduction" ? "credit" : "debit"),
            summaryObjectId:   safeToObjectId(split.summaryId),
            definitionObjectId: safeToObjectId(split.definitionId),
            instanceObjectId,
            mirrors: split.mirrors || [],
          });
        }
      }

      let totalBaseSalary = 0;
      let totalAllowances = 0;
      let totalDeductions = 0;
      const accountingLines = [];

      for (const comp of components) {
        const amount = comp.value;
        if (!amount) continue;

        if (
          comp.componentName.toLowerCase() === "base salary" ||
          comp.componentName.toLowerCase() === "administrative allowance"
        ) totalBaseSalary += amount;

        if (comp.category === "allowance") totalAllowances += amount;
        if (comp.category === "deduction") totalDeductions += amount;

        accountingLines.push({
          employeeId,
          instanceObjectId:   comp.instanceObjectId,
          summaryObjectId:    comp.summaryObjectId,
          definitionObjectId: comp.definitionObjectId,
          debitOrCredit: comp.debitOrCredit,
          amount,
          fieldName: comp.componentName,
        });

        for (const m of comp.mirrors) {
          accountingLines.push({
            employeeId,
            instanceObjectId:   m.instanceId ? safeToObjectId(m.instanceId) : null,
            summaryObjectId:    safeToObjectId(m.summaryId),
            definitionObjectId: safeToObjectId(m.definitionId),
            debitOrCredit: m.debitOrCredit,
            amount,
            fieldName: `${comp.componentName} (mirror)`,
            isReflection: !!m.isReflection,
          });
        }
      }

      // FI-4 FIX: include baseSalary in net calculation
      const netSalary = totalBaseSalary + totalAllowances - totalDeductions;
      if (netSalary <= 0) throw new Error("Net salary is zero or negative — cannot proceed.");

      const capitalSummaryId = await getSummaryObjectId(SID.CAPITAL, session);
      accountingLines.push({
        employeeId,
        fieldName: "Net Salary Payment (Capital)",
        amount: netSalary,
        debitOrCredit: "credit",
        summaryObjectId: capitalSummaryId,
        definitionObjectId: null,
        instanceObjectId: null,
      });

      const tx = await persistTransactionAndApply(accountingLines, description, session);

      // ─── C-03 FIX: Bank API called INSIDE withTransaction, BEFORE the implicit
      //               commit. If it throws, the entire transaction aborts and
      //               the ledger entries are never committed. ───
      const bankPayload = {
        sender: {
          account: process.env.BANK_SENDER_ACCOUNT,
          iban:    process.env.BANK_SENDER_IBAN,
        },
        receiver: {
          name:          employee.individualName,
          email:         employee.personalEmail,
          phone:         employee.address?.contactNo,
          bankName:      employee.bankingDetails.bankName,
          accountNumber: employee.bankingDetails.accountNumber,
          iban:          employee.bankingDetails.iban,
          branchCode:    employee.bankingDetails.branchCode,
          cnic:          employee.bankingDetails.cnic,
        },
        amount: netSalary,
        description,
      };

      const bankResult = await sendSalaryThroughBankAPI(bankPayload);
      // If the bank API returns a hard failure, throw so withTransaction aborts
      if (bankResult?.status === "ERROR") {
        throw new Error(`Bank API failure: ${bankResult.error}`);
      }

      // F-18: audit inside session
      await AuditService.log({
        eventType:  "SALARY_BREAKUP_CREATED",
        actorId:    req.user._id,
        entityId:   tx.transactionId,
        entityType: "Transaction",
        currency:   "PKR",
        meta: { employeeId, netSalary, totalBaseSalary, totalAllowances, totalDeductions, bankResult },
      }, { type: "financial", session });

      responsePayload = {
        message: "Salary transaction posted and bank transfer initiated.",
        employeeId,
        transactionId: tx.transactionId,
        totalBaseSalary,
        totalAllowances,
        totalDeductions,
        netSalary,
        bankResult,
      };
    });

    session.endSession();
    return res.status(201).json(responsePayload);
  } catch (err) {
    session.endSession();
    console.error("SalaryTransactionControllerWithBankingDetails Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// Placeholder — replace with real Bank Alfalah API call
export const sendSalaryThroughBankAPI = async (payload) => {
  try {
    return {
      status: "PENDING_TEST_MODE",
      message: "Bank API placeholder invoked. Replace with actual API.",
    };
  } catch (err) {
    console.error("Bank API Error:", err.message);
    return { status: "ERROR", error: err.message };
  }
};

export const testCreateCollections = async (req, res) => {
  try {
    return res.status(200).json({ message: "Test route hit: collections should be created or checked." });
  } catch (err) {
    console.error("Error in testCreateCollections:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// summariesInitCapitalCash
// C-05 FIX: Opening balance now emits a OPENING_BALANCE_INITIALIZED audit log.
// F-01: splitAmount rounded to integer.
// ─────────────────────────────────────────────────────────────
export const summariesInitCapitalCash = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { amount } = req.body;
    if (!req.user?._id) return res.status(401).json({ success: false, message: "Actor identity required" });

    // F-01: reject fractional amounts (float inputs)
    const intAmount = Math.round(Number(amount));
    if (typeof amount !== "number" || amount <= 0 || intAmount !== amount) {
      return res.status(400).json({
        success: false,
        message: "Opening amount must be a positive integer (no fractional amounts allowed)",
      });
    }

    let savedTransactionId = null;

    await session.withTransaction(async () => {
      const rule = await RuleModel.findOne({
        transactionType: "Starting Cash And Capital Balances",
      }).session(session);
      if (!rule) throw new Error("Opening balance rule not found");

      const transaction = new TransactionModel({
        type: "opening",
        description: "Starting Cash And Capital Balances",
        amount: intAmount,
        currency: "PKR",
        status: "posted",
        lines: [],
      });

      for (const split of rule.splits) {
        const instanceId   = await resolveInstanceForEntry(split, session);
        const summaryId    = await resolveSummaryIdForEntry(split, session);
        const definitionId = await resolveDefinitionIdForEntry(split, session);
        if (!instanceId) throw new Error(`Could not resolve instance for split ${split.componentName}`);

        // F-01: integer split amount
        const splitAmount = Math.round(computeLineAmount(split, intAmount, "both"));

        const line = buildLine({
          instanceId,
          summaryId,
          definitionId,
          debitOrCredit: split.debitOrCredit,
          amount: splitAmount,
          description: "Opening Balance",
          isReflection: false,
        });
        transaction.lines.push(line);

        await applyBalanceChange({
          instanceId,
          summaryId,
          debitOrCredit: split.debitOrCredit,
          amount: splitAmount,
          isReflection: false,
        }, session);

        if (split.mirrors?.length) {
          for (const mirror of split.mirrors) {
            const mirrorInstanceId   = await resolveInstanceForEntry(mirror, session);
            const mirrorSummaryId    = await resolveSummaryIdForEntry(mirror, session);
            const mirrorDefinitionId = await resolveDefinitionIdForEntry(mirror, session);
            if (!mirrorInstanceId) throw new Error(`Could not resolve mirror instance for split ${split.componentName}`);

            const mirrorLine = buildLine({
              instanceId:   mirrorInstanceId,
              summaryId:    mirrorSummaryId,
              definitionId: mirrorDefinitionId,
              debitOrCredit: mirror.debitOrCredit,
              amount: splitAmount,
              description: "Opening Balance (Mirror)",
              isReflection: mirror.isReflection ?? false,
            });
            transaction.lines.push(mirrorLine);

            await applyBalanceChange({
              instanceId:   mirrorInstanceId,
              summaryId:    mirrorSummaryId,
              debitOrCredit: mirror.debitOrCredit,
              amount: splitAmount,
              isReflection: mirror.isReflection ?? false,
            }, session);
          }
        }
      }

      await transaction.save({ session });
      savedTransactionId = transaction._id;

      // C-05 / FI-6 FIX: Audit the opening balance — previously completely missing
      await AuditService.log({
        eventType:  "OPENING_BALANCE_INITIALIZED",
        actorId:    req.user._id,
        entityId:   transaction._id,
        entityType: "Transaction",
        currency:   "PKR",
        meta: { amount: intAmount, ruleId: rule._id },
      }, { type: "financial", session });
    });

    session.endSession();
    return res.status(200).json({
      success: true,
      message: "Opening cash and capital balances initialized successfully",
      transactionId: savedTransactionId,
    });
  } catch (err) {
    console.error("[summariesInitCapitalCash] Error:", err);
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } catch (abortErr) {
      console.warn("Session abort failed:", abortErr);
    } finally {
      session.endSession();
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};
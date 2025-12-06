// controllers/FinanceControllers/ExpenseAndCommissionControllers.js
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

import Seller from "../../models/FinanceModals/SellersModel.js";
import Buyer from "../../models/FinanceModals/BuyersModel.js";
import Order from "../../models/FinanceModals/OrdersModel.js";
import Payment from "../../models/FinanceModals/PaymentModel.js";

// ----------------- Helpers -----------------

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

/**
 * Attempt to resolve an instance ObjectId for a split or mirror using many fallbacks.
 * Accepts object with optional keys:
 *   - instanceId
 *   - definitionId
 *   - fieldLineId (numeric)
 *   - summaryId (numeric or ObjectId)
 *
 * Returns an ObjectId or null.
 */
// helpers

async function resolveInstanceForEntry(entry, session = null) {
  if (entry.instanceId) return safeToObjectId(entry.instanceId);

  if (entry.definitionId) {
    const inst = await SummaryFieldLineInstance.findOne({ definitionId: safeToObjectId(entry.definitionId) }).session(session);
    if (inst) return inst._id;
  }
  return null;
}

async function resolveSummaryIdForEntry(entry, session = null) {
  if (entry.summaryId) return safeToObjectId(entry.summaryId);

  if (typeof entry.summaryNumericId === "number") {
    const summary = await SummaryModel.findOne({ summaryId: entry.summaryNumericId }).session(session);
    if (summary) return summary._id;
  }
  return null;
}

async function resolveDefinitionIdForEntry(entry, session = null) {
  if (entry.definitionId) return safeToObjectId(entry.definitionId);

  if (entry.fieldLineId) {
    const def = await SummaryFieldLineDefinition.findOne({ fieldLineNumericId: entry.fieldLineId }).session(session);
    if (def) return def._id;
  }
  return null;
}

function computeLineAmount(split, baseAmount = 0, incrementType = "both", totalPercent = 100) {
  const fixed = Number(split.fixedAmount || 0);
  const perc = Number(split.percentage || 0);

  if (incrementType === "fixed") return fixed;
  if (incrementType === "percentage") return (perc / (totalPercent || 100)) * baseAmount;
  return fixed + (perc / (totalPercent || 100)) * baseAmount;
}

function buildLine({ instanceId, summaryId, definitionId, debitOrCredit, amount, description, isReflection }) {
  return {
    instanceId,
    summaryId,
    definitionId,
    debitOrCredit,
    amount: mongoose.Types.Decimal128.fromString(Number(amount || 0).toFixed(2)),
    description: description || "",
    isReflection: !!isReflection
  };
}

async function applyBalanceChange({ instanceId, summaryId, debitOrCredit, amount }, session = null) {
  const amt = Number(amount || 0);
  if (amt === 0) return;

  const increment = debitOrCredit === "debit" ? amt : -amt;

  if (instanceId) {
    await SummaryFieldLineInstance.findByIdAndUpdate(instanceId, { $inc: { balance: increment } }, { session });
    const inst = await SummaryFieldLineInstance.findById(instanceId).session(session);
    if (inst?.summaryId) {
      await SummaryModel.findByIdAndUpdate(inst.summaryId, { $inc: { endingBalance: increment } }, { session });
    }
    return;
  }

  if (summaryId) {
    await SummaryModel.findByIdAndUpdate(summaryId, { $inc: { endingBalance: increment } }, { session });
  }
}

export const ExpenseTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, name, description } = req.body;
    const baseAmount = Number(amount);
    if (!baseAmount || baseAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Invalid amount" });
    }

    // 1️⃣ Fetch rules
    const rules = await TablesModel.find({ transactionType: "Expense Allocation" }).session(session).lean();
    if (!rules.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "No Expense Allocation rules found" });
    }

    const transactionLines = [];

    // 2️⃣ Process rules
    for (const rule of rules) {
      const splits = rule.splits || [];
      const totalPercent = splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0) || 100;

      for (const split of splits) {
        const splitAmount = computeLineAmount(split, baseAmount, rule.incrementType, totalPercent);
        if (!splitAmount) continue;

        // 🛠 Debugging: log the split before resolving
        console.log("Processing split:", split.fieldName);
        console.log("Split raw IDs:", {
          instanceId: split.instanceId,
          summaryId: split.summaryId,
          definitionId: split.definitionId
        });

        const instanceId = await resolveInstanceForEntry(split, session);
        const summaryId = await resolveSummaryIdForEntry(split, session);
        const definitionId = await resolveDefinitionIdForEntry(split, session);

        if (!instanceId || !summaryId || !definitionId) {
          console.warn("Skipping split: unresolved IDs", {
            fieldName: split.fieldName,
            instanceIdResolved: instanceId,
            summaryIdResolved: summaryId,
            definitionIdResolved: definitionId,
            originalSplit: split
          });
          continue;
        }

        transactionLines.push(buildLine({
          instanceId,
          summaryId,
          definitionId,
          debitOrCredit: split.debitOrCredit,
          amount: splitAmount,
          description: split.fieldName,
          isReflection: !!split.isReflection
        }));

        // Process mirrors
        if (Array.isArray(split.mirrors)) {
          for (const mirror of split.mirrors) {
            // 🛠 Debugging: log mirror before resolving
            console.log("Processing mirror:", mirror.fieldName || `${split.fieldName} Mirror`);
            console.log("Mirror raw IDs:", {
              instanceId: mirror.instanceId,
              summaryId: mirror.summaryId,
              definitionId: mirror.definitionId
            });

            const mirrorInstanceId = await resolveInstanceForEntry(mirror, session);
            const mirrorSummaryId = await resolveSummaryIdForEntry(mirror, session);
            const mirrorDefinitionId = await resolveDefinitionIdForEntry(mirror, session);

            if (!mirrorInstanceId || !mirrorSummaryId || !mirrorDefinitionId) {
              console.warn("Skipping mirror: unresolved IDs", {
                description: mirror.fieldName || `${split.fieldName} Mirror`,
                instanceIdResolved: mirrorInstanceId,
                summaryIdResolved: mirrorSummaryId,
                definitionIdResolved: mirrorDefinitionId,
                originalMirror: mirror
              });
              continue;
            }

            transactionLines.push(buildLine({
              instanceId: mirrorInstanceId,
              summaryId: mirrorSummaryId,
              definitionId: mirrorDefinitionId,
              debitOrCredit: mirror.debitOrCredit,
              amount: splitAmount,
              description: mirror.fieldName || `${split.fieldName} Mirror`,
              isReflection: true
            }));
          }
        }
      }
    }

    if (!transactionLines.length) {
      throw new Error("No valid transaction lines to create. Check logs for unresolved IDs.");
    }

    // 3️⃣ Compute totals
    const totalDebits = transactionLines.filter(l => l.debitOrCredit === "debit").reduce((sum, l) => sum + parseFloat(l.amount.toString()), 0);
    const totalCredits = transactionLines.filter(l => l.debitOrCredit === "credit").reduce((sum, l) => sum + parseFloat(l.amount.toString()), 0);

    // 4️⃣ Create transaction
    const [tx] = await TransactionModel.create([{
      date: new Date(),
      description: description || name || "Expense Transaction",
      type: "journal",
      amount: mongoose.Types.Decimal128.fromString(baseAmount.toFixed(2)),
      createdBy: req.user?._id || null,
      status: "posted",
      totalDebits: mongoose.Types.Decimal128.fromString(totalDebits.toFixed(2)),
      totalCredits: mongoose.Types.Decimal128.fromString(totalCredits.toFixed(2)),
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      lines: transactionLines
    }], { session });

    // 5️⃣ Apply balances
    for (const line of transactionLines) {
      await applyBalanceChange({
        instanceId: line.instanceId,
        summaryId: line.summaryId,
        debitOrCredit: line.debitOrCredit,
        amount: parseFloat(line.amount.toString())
      }, session);
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Expense transaction posted successfully",
      transactionId: tx._id,
      linesPosted: transactionLines.length,
      totalDebits,
      totalCredits
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("ExpenseTransactionController Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// ----------------- Commission Transaction -----------------
export const CommissionTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid commission amount" });

    const commissionInstance = await SummaryFieldLineInstance.findOne({ fieldLineNumericId: 5201 }).session(session);
    const cashInstance = await SummaryFieldLineInstance.findOne({ fieldLineNumericId: 5301 }).session(session);

    const commissionSummaryObj = await getSummaryObjectId(SID.COMMISSION, session);
    const cashSummaryObj = await getSummaryObjectId(SID.CASH, session);

    const accountingLines = [
      {
        instanceObjectId: cashInstance ? cashInstance._id : null,
        summaryObjectId: cashSummaryObj,
        summaryNumericId: SID.CASH,
        definitionObjectId: cashInstance ? cashInstance.definitionId : null,
        debitOrCredit: "debit",
        amount: Math.round(Number(amount) * 100) / 100,
        fieldName: "Commission received (Cash)"
      },
      {
        instanceObjectId: commissionInstance ? commissionInstance._id : null,
        summaryObjectId: commissionSummaryObj,
        summaryNumericId: SID.COMMISSION,
        definitionObjectId: commissionInstance ? commissionInstance.definitionId : null,
        debitOrCredit: "credit",
        amount: Math.round(Number(amount) * 100) / 100,
        fieldName: "Commission Income"
      }
    ];

    const tx = await persistTransactionAndApply(accountingLines, description || "Commission Transaction", session);

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

// ----------------- Commission → Retained -----------------
export const transferCommissionToRetained = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const commissionSummary = await SummaryModel.findOne({ summaryId: SID.COMMISSION }).session(session);
    if (!commissionSummary) throw new Error("Commission summary not found");

    const retainedInstance = await SummaryFieldLineInstance.findOne({ fieldLineNumericId: 5401 }).session(session);
    if (!retainedInstance) throw new Error("Retained Income instance not found");

    const retainedSummary = await SummaryModel.findById(retainedInstance.summaryId).session(session);
    if (!retainedSummary) throw new Error("Retained Summary not found");

    const commissionAmount = Math.abs(Math.round((commissionSummary.endingBalance || 0) * 100) / 100);
    if (commissionAmount === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "No commission to transfer" });
    }

    const accountingLines = [
      {
        instanceObjectId: null,
        summaryObjectId: commissionSummary._id,
        summaryNumericId: commissionSummary.summaryId,
        definitionObjectId: null,
        debitOrCredit: "debit",
        amount: commissionAmount,
        fieldName: "Close Commission → Retained (debit commission)"
      },
      {
        instanceObjectId: retainedInstance._id,
        summaryObjectId: retainedSummary._id,
        summaryNumericId: retainedSummary.summaryId,
        definitionObjectId: retainedInstance.definitionId || null,
        debitOrCredit: "credit",
        amount: commissionAmount,
        fieldName: "Close Commission → Retained (credit retained)"
      }
    ];

    const tx = await persistTransactionAndApply(accountingLines, "Close commission → retained", session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: `Transferred ${commissionAmount} commission → Retained Income`,
      commissionBalance: commissionSummary.endingBalance - commissionAmount,
      retainedBalance: retainedInstance.balance + commissionAmount,
      transactionId: tx.transactionId
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("transferCommissionToRetained Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// ----------------- Retained → Capital -----------------
export const transferRetainedIncomeToCapital = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const retainedInstance = await SummaryFieldLineInstance.findOne({ fieldLineNumericId: 5401 }).session(session);
    const capitalInstance = await SummaryFieldLineInstance.findOne({ fieldLineNumericId: 5101 }).session(session);

    if (!retainedInstance || !capitalInstance) throw new Error("Retained Income or Capital instance not found");

    const retainedSummary = await SummaryModel.findById(retainedInstance.summaryId).session(session);
    const capitalSummary = await SummaryModel.findById(capitalInstance.summaryId).session(session);

    const transferAmount = Math.abs(Math.round((retainedInstance.balance || 0) * 100) / 100);
    if (transferAmount === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "No retained income to transfer" });
    }

    const accountingLines = [
      {
        instanceObjectId: retainedInstance._id,
        summaryObjectId: retainedSummary._id,
        summaryNumericId: retainedSummary.summaryId,
        definitionObjectId: retainedInstance.definitionId || null,
        debitOrCredit: "debit",
        amount: transferAmount,
        fieldName: "Transfer Retained → Capital (debit retained)"
      },
      {
        instanceObjectId: capitalInstance._id,
        summaryObjectId: capitalSummary._id,
        summaryNumericId: capitalSummary.summaryId,
        definitionObjectId: capitalInstance.definitionId || null,
        debitOrCredit: "credit",
        amount: transferAmount,
        fieldName: "Transfer Retained → Capital (credit capital)"
      }
    ];

    const tx = await persistTransactionAndApply(accountingLines, "Transfer retained → capital", session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: `Transferred ${transferAmount} retained → capital`,
      retainedBalance: retainedInstance.balance - transferAmount,
      capitalBalance: capitalInstance.balance + transferAmount,
      transactionId: tx.transactionId
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("transferRetainedIncomeToCapital Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// ----------------- Salary Transaction Controller -----------------
export const SalaryTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employeeId = req.params.employeeId || req.body.employeeId;
    if (!employeeId) throw new Error("❌ Employee ID is required.");

    const description = req.body.description || `Salary Transaction - ${employeeId}`;

    const rules = await BreakupRuleModel.find({transactionType: "Salary"}).session(session).lean();
    if (!rules?.length) throw new Error("❌ No Breakup Rules found.");

    const breakupFile = await BreakupFileModel.findOne({ employeeId }).session(session).lean();
    if (!breakupFile) throw new Error(`❌ No Breakup File found for employee ${employeeId}`);

    const computedBreakdown = breakupFile?.calculatedBreakup?.breakdown || [];
    let components = [];

    // Map rules → computed values
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
            summaryId: split.summaryId,
          })
            .session(session)
            .lean();
          if (instance) instanceObjectId = instance._id;
        }

        components.push({
          componentName: split.componentName,
          value,
          category: computed?.category || split.type,
          debitOrCredit:
            split.debitOrCredit ?? (split.type === "deduction" ? "credit" : "debit"),
          summaryObjectId: safeToObjectId(split.summaryId),
          definitionObjectId: safeToObjectId(split.definitionId),
          instanceObjectId,
          mirrors: split.mirrors || [],
        });
      }
    }

    // Build accounting lines
    let totalAllowances = 0;
    let totalDeductions = 0;
    let totalBaseSalary = 0;
    const accountingLines = [];

    for (const comp of components) {
      const amount = Number(comp.value || 0);
      if (!amount) continue;

      if (
        comp.componentName.toLowerCase() === "base salary" ||
        comp.componentName.toLowerCase() === "administrative allowance"
      ) totalBaseSalary += amount;

      if (comp.category === "allowance") totalAllowances += amount;
      if (comp.category === "deduction") totalDeductions += amount;

      accountingLines.push({
        employeeId,
        instanceObjectId: comp.instanceObjectId,
        summaryObjectId: comp.summaryObjectId,
        definitionObjectId: comp.definitionObjectId,
        debitOrCredit: comp.debitOrCredit,
        amount,
        fieldName: comp.componentName,
      });

      // Handle mirrors
      for (const mirror of comp.mirrors) {
        accountingLines.push({
          employeeId,
          instanceObjectId: mirror.instanceId ? safeToObjectId(mirror.instanceId) : null,
          summaryObjectId: safeToObjectId(mirror.summaryId),
          definitionObjectId: safeToObjectId(mirror.definitionId),
          debitOrCredit: mirror.debitOrCredit,
          amount,
          fieldName: `${comp.componentName} (mirror)`,
        });
      }
    }

    // Net salary = totalAllowances - totalDeductions
    const netSalary = totalAllowances - totalDeductions;

    if (netSalary > 0) {
      // Direct credit to Capital
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

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "✅ Salary transaction posted directly to Capital",
      employeeId,
      transactionId: tx.transactionId,
      totalAllowances,
      totalDeductions,
      netSalary,
      accountingLines,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("SalaryTransactionController Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// ----------------- CONTROLLER with Bank API-----------------
export const SalaryTransactionControllerWithBankingDetails = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employeeId = req.params.employeeId || req.body.employeeId;
    if (!employeeId) throw new Error("❌ Employee ID is required.");

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) throw new Error("❌ Employee not found.");

    if (!employee.bankingDetails || !employee.bankingDetails.accountNumber) {
      throw new Error("❌ Employee banking details missing.");
    }

    const description = req.body.description || `Salary Transaction - ${employeeId}`;

    const rules = await BreakupRuleModel.find({
      transactionType: "Salary",
    })
      .session(session)
      .lean();
    if (!rules?.length) throw new Error("❌ No Breakup Rules found.");

    const breakupFile = await BreakupFileModel.findOne({ employeeId })
      .session(session)
      .lean();
    if (!breakupFile)
      throw new Error(`❌ No Breakup File found for employee ${employeeId}`);

    const computedBreakdown =
      breakupFile?.calculatedBreakup?.breakdown || [];

    let components = [];

    // ------- MAP RULES TO COMPONENTS -------
    for (const rule of rules) {
      for (const split of rule.splits || []) {
        const computed = computedBreakdown.find(
          (c) =>
            (c.name || "").toLowerCase() ===
            (split.componentName || "").toLowerCase()
        );

        const value =
          computed?.value ?? Number(split.fixedAmount || 0);

        let instanceObjectId = split.instanceId
          ? safeToObjectId(split.instanceId)
          : null;

        if (!instanceObjectId && split.definitionId && split.summaryId) {
          const instance = await SummaryFieldLineInstance.findOne({
            definitionId: split.definitionId,
            summaryId: split.summaryId,
          })
            .session(session)
            .lean();
          if (instance) instanceObjectId = instance._id;
        }

        components.push({
          componentName: split.componentName,
          value,
          category: computed?.category || split.type,
          debitOrCredit:
            split.debitOrCredit ??
            (split.type === "deduction" ? "credit" : "debit"),
          summaryObjectId: safeToObjectId(split.summaryId),
          definitionObjectId: safeToObjectId(split.definitionId),
          instanceObjectId,
          mirrors: split.mirrors || [],
        });
      }
    }

    // ------- ACCOUNTING LINES -------
    let totalAllowances = 0;
    let totalDeductions = 0;

    const accountingLines = [];

    for (const comp of components) {
      const amount = Number(comp.value || 0);
      if (!amount) continue;

      if (comp.category === "allowance") totalAllowances += amount;
      if (comp.category === "deduction") totalDeductions += amount;

      accountingLines.push({
        employeeId,
        instanceObjectId: comp.instanceObjectId,
        summaryObjectId: comp.summaryObjectId,
        definitionObjectId: comp.definitionObjectId,
        debitOrCredit: comp.debitOrCredit,
        amount,
        fieldName: comp.componentName,
      });

      // Mirrors
      for (const m of comp.mirrors) {
        accountingLines.push({
          employeeId,
          instanceObjectId: m.instanceId ? safeToObjectId(m.instanceId) : null,
          summaryObjectId: safeToObjectId(m.summaryId),
          definitionObjectId: safeToObjectId(m.definitionId),
          debitOrCredit: m.debitOrCredit,
          amount,
          fieldName: `${comp.componentName} (mirror)`,
        });
      }
    }

    // Net salary
    const netSalary = totalAllowances - totalDeductions;

    if (netSalary <= 0) {
      throw new Error("❌ Net salary is zero or negative — cannot proceed.");
    }

    // CAPITAL ENTRY
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

    // ------- PROCESS ACCOUNTING --------
    const tx = await persistTransactionAndApply(
      accountingLines,
      description,
      session
    );

    // ------- BANK PAYMENT (NEW PART) --------

    const bankPayload = {
      sender: {
        account: process.env.BANK_SENDER_ACCOUNT,
        iban: process.env.BANK_SENDER_IBAN,
      },
      receiver: {
        name: employee.individualName,
        email: employee.personalEmail,
        phone: employee.address.contactNo,
        bankName: employee.bankingDetails.bankName,
        accountNumber: employee.bankingDetails.accountNumber,
        iban: employee.bankingDetails.iban,
        branchCode: employee.bankingDetails.branchCode,
        cnic: employee.bankingDetails.cnic,
      },
      amount: netSalary,
      description,
    };

    const bankResult = await sendSalaryThroughBankAPI(bankPayload);

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "✅ Salary transaction posted and bank transfer initiated.",
      employeeId,
      transactionId: tx.transactionId,
      totalAllowances,
      totalDeductions,
      netSalary,
      bankResult,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("SalaryTransactionController Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// Helper function for the above...
export const sendSalaryThroughBankAPI = async (payload) => {
  try {
    console.log("\n🏦 [BANK API] Initiating Salary Transfer...");
    console.log("Sender:", payload.sender);
    console.log("Receiver:", payload.receiver);
    console.log("Amount:", payload.amount);

    // -------------------------------------------------------------
    // 🔥 HERE YOU WILL LATER INTEGRATE THE REAL BANK ALFALAH API
    // -------------------------------------------------------------

    // Example placeholder response
    return {
      status: "PENDING_TEST_MODE",
      message: "Bank API placeholder invoked. Replace with actual API.",
      payloadSent: payload,
    };
  } catch (err) {
    console.error("Bank API Error:", err);
    return {
      status: "ERROR",
      error: err.message,
    };
  }
};

export const testCreateCollections = async (req, res) => {
  try {
    // Just send back a message; you could also trigger something that ensures
    // your collections exist via mongoose models if needed.
    return res.status(200).json({
      message: "Test route hit: collections should be created or checked."
    });
  } catch (err) {
    console.error("Error in testCreateCollections:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
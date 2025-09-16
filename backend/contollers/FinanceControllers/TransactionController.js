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

// Helper function for safe ObjectId conversion
const safeToObjectId = (id) => {
  if (!id) return null;
  const idStr = String(id);
  return mongoose.Types.ObjectId.isValid(idStr) ? new mongoose.Types.ObjectId(idStr) : null;
};

// Summary numeric IDs (kept from your file)
const SID = {
  ALLOWANCES: 1100,
  EXPENSES: 1200,
  BANK: 1300,
  SALARIES: 1400,
  CASH: 1500,
  CAPITAL: 1600,
  COMMISSION: 1700,
};

// ----------------- Helpers -----------------

function computeLineAmount(split, baseAmount = 0, incrementType = "both", totalPercent = 100) {
  if (!split) return 0;
  const fixed = Number(split.fixedAmount || 0);
  const perc = Number(split.percentage || 0);

  if (incrementType === "fixed") {
    return Math.round(fixed * 100) / 100;
  }
  if (incrementType === "percentage") {
    const p = (perc / (totalPercent || 100)) * baseAmount;
    return Math.round(p * 100) / 100;
  }
  const p = (perc / (totalPercent || 100)) * baseAmount;
  return Math.round((fixed + p) * 100) / 100;
}

/**
 * Resolve numeric summaryId -> Summary _id (ObjectId). Throws if not found.
 */
async function getSummaryObjectId(numericSummaryId, session = null) {
  if (numericSummaryId === null || numericSummaryId === undefined) return null;
  const q = SummaryModel.findOne({ summaryId: numericSummaryId });
  if (session) q.session(session);
  const summary = await q;
  if (!summary) throw new Error(`Summary with summaryId ${numericSummaryId} not found`);
  return summary._id;
}

/**
 * Helper to resolve a definition by numeric id (fieldLineNumericId) -> Definition._id
 */
async function getDefinitionByNumericId(numericId, session = null) {
  if (numericId === null || numericId === undefined) return null;
  const q = SummaryFieldLineDefinition.findOne({ fieldLineNumericId: numericId });
  if (session) q.session(session);
  const def = await q;
  return def ? def._id : null;
}

/**
 * Helper to get an instance _id:
 * - Prefer provided instanceId (ObjectId string or ObjectId)
 * - Then try to find by fieldLineNumericId across instances
 * - Then try to find any instance for the target summary (fallback)
 */
async function resolveInstanceObjectId({ instanceId, numericFieldLineId, summaryId }, session = null) {
  // If instanceId passed and looks like ObjectId, return it
  if (instanceId) {
    const objectId = safeToObjectId(instanceId);
    if (objectId) return objectId;
  }

  if (numericFieldLineId) {
    const q = SummaryFieldLineInstance.findOne({ fieldLineNumericId: numericFieldLineId });
    if (session) q.session(session);
    const found = await q;
    if (found) return found._id;
  }

  if (summaryId) {
    // if numeric summaryId given (number), resolve to ObjectId
    let summaryObjId = null;
    if (typeof summaryId === "number") {
      summaryObjId = await getSummaryObjectId(summaryId, session);
    } else {
      summaryObjId = safeToObjectId(summaryId);
    }

    if (summaryObjId) {
      const q = SummaryFieldLineInstance.findOne({ summaryId: summaryObjId });
      if (session) q.session(session);
      const inst = await q;
      if (inst) return inst._id;
    }
  }

  return null;
}

/**
 * Update balances:
 * - If line contains instanceObjectId -> update that instance.balance and then update its parent Summary.endingBalance
 * - Else if summaryObjectId -> update summary endingBalance
 * - Else if summaryNumericId -> resolve to summary doc and update
 *
 * debit increases (+), credit decreases (-)
 */
async function applyBalanceChange({ instanceObjectId, summaryObjectId, summaryNumericId, debitOrCredit, amount }, session = null) {
  const amt = Number(amount || 0);
  if (amt === 0) return;

  const increment = debitOrCredit === "debit" ? amt : -amt;

  if (instanceObjectId) {
    const iid = safeToObjectId(instanceObjectId);
    if (!iid) {
      console.warn("[WARN] Invalid instanceObjectId provided for balance update");
      return;
    }
    
    await SummaryFieldLineInstance.findByIdAndUpdate(iid, { $inc: { balance: increment } }, { session });
    const inst = session ? await SummaryFieldLineInstance.findById(iid).session(session) : await SummaryFieldLineInstance.findById(iid);
    
    if (inst && inst.summaryId) {
      await SummaryModel.findByIdAndUpdate(inst.summaryId, { $inc: { endingBalance: increment } }, { session });
    }
    return;
  }

  if (summaryObjectId) {
    const summaryId = safeToObjectId(summaryObjectId);
    if (summaryId) {
      await SummaryModel.findByIdAndUpdate(summaryId, { $inc: { endingBalance: increment } }, { session });
    }
    return;
  }

  if (summaryNumericId) {
    const sdoc = await SummaryModel.findOne({ summaryId: summaryNumericId }).session(session);
    if (sdoc) await SummaryModel.findByIdAndUpdate(sdoc._id, { $inc: { endingBalance: increment } }, { session });
    else console.warn(`[WARN] No summary found for numeric summaryId ${summaryNumericId}`);
    return;
  }

  console.warn("[WARN] No instance or summary provided for balance update", { debitOrCredit, amount });
}

/**
 * Helper: get an instance _id by numeric fieldLine id
 */
async function getInstanceByNumericFieldLineId(numericId, session = null) {
  if (!numericId && numericId !== 0) return null;
  const q = SummaryFieldLineInstance.findOne({ fieldLineNumericId: numericId });
  if (session) q.session(session);
  const inst = await q;
  return inst ? inst._id : null;
}

// ----------------- Funding lines (Commission -> Cash -> Capital) -----------------
async function buildFundingLinesViaInstances(amountNeeded, session) {
  const fundingLines = [];
  amountNeeded = Math.round(Number(amountNeeded || 0) * 100) / 100;
  if (amountNeeded <= 0) return fundingLines;

  const commissionSummary = await SummaryModel.findOne({ summaryId: SID.COMMISSION }).session(session);
  const commissionBalance = commissionSummary ? Number(commissionSummary.endingBalance || 0) : 0;

  // Prefer instances that represent cash/commission/capital if available
  const cashInstance = await SummaryFieldLineInstance.findOne({ fieldLineNumericId: 5301 }).session(session);
  const commissionInstance = await SummaryFieldLineInstance.findOne({ fieldLineNumericId: 5201 }).session(session);
  const capitalInstance = await SummaryFieldLineInstance.findOne({ fieldLineNumericId: 5101 }).session(session);

  const cashSummaryObj = await getSummaryObjectId(SID.CASH, session);
  const commissionSummaryObj = await getSummaryObjectId(SID.COMMISSION, session);
  const capitalSummaryObj = await getSummaryObjectId(SID.CAPITAL, session);

  let remaining = amountNeeded;

  if (commissionBalance > 0) {
    const fromCommission = Math.min(commissionBalance, remaining);
    fundingLines.push({
      instanceObjectId: cashInstance ? cashInstance._id : null,
      summaryObjectId: cashSummaryObj,
      summaryNumericId: SID.CASH,
      definitionObjectId: cashInstance ? cashInstance.definitionId : null,
      debitOrCredit: "debit",
      amount: fromCommission,
      fieldName: "Fund from Commission -> Cash"
    });
    fundingLines.push({
      instanceObjectId: commissionInstance ? commissionInstance._id : null,
      summaryObjectId: commissionSummaryObj,
      summaryNumericId: SID.COMMISSION,
      definitionObjectId: commissionInstance ? commissionInstance.definitionId : null,
      debitOrCredit: "credit",
      amount: fromCommission,
      fieldName: "Reduce Commission (fund cash)"
    });
    remaining = Math.round((remaining - fromCommission) * 100) / 100;
  }

  if (remaining > 0.00001) {
    fundingLines.push({
      instanceObjectId: cashInstance ? cashInstance._id : null,
      summaryObjectId: cashSummaryObj,
      summaryNumericId: SID.CASH,
      definitionObjectId: cashInstance ? cashInstance.definitionId : null,
      debitOrCredit: "debit",
      amount: remaining,
      fieldName: "Fund from Capital -> Cash"
    });
    fundingLines.push({
      instanceObjectId: capitalInstance ? capitalInstance._id : null,
      summaryObjectId: capitalSummaryObj,
      summaryNumericId: SID.CAPITAL,
      definitionObjectId: capitalInstance ? capitalInstance.definitionId : null,
      debitOrCredit: "credit",
      amount: remaining,
      fieldName: "Reduce Capital (fund cash)"
    });
    remaining = 0;
  }

  return fundingLines;
}

/**
 * Persist transaction and apply balances.
 */
async function persistTransactionAndApply(accountingLines, description = "Transaction", session) {
  // Resolve numeric summary IDs to ObjectIds for tx lines BEFORE creating the transaction doc
  const resolvedTxLines = [];
  for (const l of accountingLines) {
    let resolvedSummaryId = null;
    if (l.summaryObjectId) {
      resolvedSummaryId = safeToObjectId(l.summaryObjectId);
    } else if (l.summaryNumericId) {
      // convert numeric summary id -> ObjectId (will throw if missing)
      try {
        resolvedSummaryId = await getSummaryObjectId(l.summaryNumericId, session);
      } catch (err) {
        console.warn(`[persistTransactionAndApply] Could not resolve numeric summaryId ${l.summaryNumericId}: ${err.message}`);
        resolvedSummaryId = null;
      }
    } else {
      resolvedSummaryId = null;
    }

    // ensure instanceId/definitionId are ObjectIds or null
    const instanceId = safeToObjectId(l.instanceObjectId);
    const definitionId = safeToObjectId(l.definitionObjectId);

    resolvedTxLines.push({
      instanceId: instanceId,
      summaryId: resolvedSummaryId,
      definitionId: definitionId,
      debitOrCredit: l.debitOrCredit,
      amount: Math.round(Number(l.amount || 0) * 100) / 100,
      fieldName: l.fieldName || ""
    });
  }

  // compute cash credits total for 'amount' on transaction meta (optional business rule)
  let cashCreditsTotal = 0;
  for (const l of resolvedTxLines) {
    if (l.summaryId) {
      const s = await SummaryModel.findById(l.summaryId).session(session);
      if (s && s.summaryId === SID.CASH && l.debitOrCredit === "credit") {
        cashCreditsTotal += Number(l.amount || 0);
      }
    }
  }

  // create transaction document
  const txDoc = await TransactionModel.create([{
    transactionId: Date.now(),
    date: new Date(),
    description,
    amount: Math.round(cashCreditsTotal * 100) / 100,
    lines: resolvedTxLines
  }], { session });

  // Apply balances (use original accountingLines values for source information)
  for (const l of accountingLines) {
    await applyBalanceChange({
      instanceObjectId: l.instanceObjectId || null,
      summaryObjectId: l.summaryObjectId || null,
      summaryNumericId: l.summaryNumericId || null,
      debitOrCredit: l.debitOrCredit,
      amount: l.amount
    }, session);
  }

  return txDoc[0];
}

// ----------------- Expense Transaction -----------------
export const ExpenseTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, name, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

    const rules = await TablesModel.find({ transactionType: "Expense Allocation" }).session(session).lean();
    if (!rules || rules.length === 0) return res.status(400).json({ error: "No Expense Allocation rules found" });

    const accountingLines = [];

    for (const rule of rules) {
      const splits = rule.splits || [];
      const totalPercent = splits.reduce((s, sp) => s + (sp.percentage || 0), 0) || 100;

      for (const split of splits) {
        const lineAmount = computeLineAmount(split, amount, rule.incrementType, totalPercent);
        if (!lineAmount) continue;

        // --- Resolve main instance & balances ---
        const mainInstanceId = split.instanceId
          ? safeToObjectId(split.instanceId)
          : await resolveInstanceObjectId({ numericFieldLineId: split.fieldLineId, summaryId: split.summaryId }, session);

        const mainSummaryObjId = (split.summaryId && typeof split.summaryId === "number")
          ? await getSummaryObjectId(split.summaryId, session)
          : safeToObjectId(split.summaryId);

        const definitionObj = split.definitionId
          ? safeToObjectId(split.definitionId)
          : (split.fieldLineId ? await getDefinitionByNumericId(split.fieldLineId, session) : null);

        let startingBalance = 0;
        if (mainInstanceId) {
          const inst = await SummaryFieldLineInstance.findById(mainInstanceId).session(session);
          startingBalance = inst?.balance || 0;
        }

        const endingBalance = split.debitOrCredit === "debit"
          ? startingBalance + lineAmount
          : startingBalance - lineAmount;

        accountingLines.push({
          instanceObjectId: mainInstanceId,
          summaryObjectId: mainSummaryObjId,
          summaryNumericId: typeof split.summaryId === "number" ? split.summaryId : null,
          definitionObjectId: definitionObj,
          debitOrCredit: split.debitOrCredit || "debit",
          amount: lineAmount,
          fieldName: split.fieldName || `Expense ${split.fieldLineId || ""}`,
          startingBalance,
          endingBalance
        });

        // --- Mirrors ---
        if (Array.isArray(split.mirrors) && split.mirrors.length) {
          for (const mirror of split.mirrors) {
            const mirrorInstId = mirror.instanceId
              ? safeToObjectId(mirror.instanceId)
              : await resolveInstanceObjectId({ numericFieldLineId: mirror.fieldLineId, summaryId: mirror.summaryId }, session);

            const mirrorSummaryObjId = (mirror.summaryId && typeof mirror.summaryId === "number")
              ? await getSummaryObjectId(mirror.summaryId, session)
              : safeToObjectId(mirror.summaryId);

            const mirrorDefObj = mirror.definitionId
              ? safeToObjectId(mirror.definitionId)
              : (mirror.fieldLineId ? await getDefinitionByNumericId(mirror.fieldLineId, session) : null);

            let mirrorStart = 0;
            if (mirrorInstId) {
              const mInst = await SummaryFieldLineInstance.findById(mirrorInstId).session(session);
              mirrorStart = mInst?.balance || 0;
            }

            const mirrorEnd = mirror.debitOrCredit === "debit"
              ? mirrorStart + lineAmount
              : mirrorStart - lineAmount;

            accountingLines.push({
              instanceObjectId: mirrorInstId,
              summaryObjectId: mirrorSummaryObjId,
              summaryNumericId: typeof mirror.summaryId === "number" ? mirror.summaryId : null,
              definitionObjectId: mirrorDefObj,
              debitOrCredit: mirror.debitOrCredit || "credit",
              amount: lineAmount,
              fieldName: mirror.fieldName || `Mirror for ${split.fieldName}`,
              startingBalance: mirrorStart,
              endingBalance: mirrorEnd
            });
          }
        }
      }
    }

    // Persist transaction and apply balances
    const tx = await persistTransactionAndApply(accountingLines, description || name || "Expense Transaction", session);

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ message: "Expense transaction posted successfully", transactionId: tx.transactionId, accountingLines });
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

export const SalaryTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employeeId = req.params.employeeId || req.body.employeeId;
    const description = req.body.description || `Salary Transaction - ${employeeId}`;

    if (!employeeId) {
      throw new Error("❌ Employee ID is required for salary transaction.");
    }

    // 1️⃣ Fetch Breakup Rules (used only for mapping to correct summaries/instances)
    const rules = await BreakupRuleModel.find({}).session(session).lean();
    if (!rules?.length) {
      throw new Error(`❌ No Breakup Rules found for employee ${employeeId}`);
    }

    // 2️⃣ Fetch Breakup File (contains already computed values)
    const breakupFile = await BreakupFileModel.findOne({ employeeId }).session(session);
    if (!breakupFile) {
      throw new Error(`❌ No Breakup File found for employee ${employeeId}`);
    }

    const computedComponents = breakupFile?.calculatedBreakup?.breakdown || [];

    // 3️⃣ Map rules to computed values
    const components = rules.flatMap(rule =>
      (rule.splits || []).map(split => {
        const computed = computedComponents.find(
          c => c.name?.toLowerCase() === split.componentName?.toLowerCase()
        );

        const value = computed?.value ?? 0; // ✅ Only use computed values

        return {
          ...split,
          value,
          debitOrCredit: split.debitOrCredit ?? (split.type === "deduction" ? "credit" : "debit"),
        };
      })
    );

    if (!components.length) {
      throw new Error(`❌ No components found after mapping rules for employee ${employeeId}`);
    }

    let totalDebits = 0;
    let totalCredits = 0;
    const accountingLines = [];

    // Helper to process a component or mirror
    const processLine = async (comp, parentAmount) => {
      const amount = Math.round((comp.value ?? parentAmount ?? 0) * 100) / 100;
      if (!amount) {
        console.warn(`⚠️ Skipping component "${comp.componentName}" - zero amount`);
        return null;
      }

      const debitOrCredit = comp.debitOrCredit;

      // Map to ObjectIds
      const summaryObjId = comp.summaryId
        ? safeToObjectId(comp.summaryId)
        : null;

      const instanceObjId = comp.instanceId
        ? safeToObjectId(comp.instanceId)
        : comp.fieldLineId
          ? await resolveInstanceObjectId(
              { numericFieldLineId: comp.fieldLineId, summaryId: comp.summaryId },
              session
            )
          : null;

      const definitionObjId = comp.definitionId
        ? safeToObjectId(comp.definitionId)
        : comp.fieldLineId
          ? await getDefinitionByNumericId(comp.fieldLineId, session)
          : null;

      if (!instanceObjId && !summaryObjId) {
        console.warn(`⚠️ Skipping component "${comp.componentName}" - no valid instance/summary`);
        return null;
      }

      const line = {
        employeeId,
        instanceObjectId: instanceObjId,
        summaryObjectId: summaryObjId,
        summaryNumericId: typeof comp.summaryId === "number" ? comp.summaryId : null,
        definitionObjectId: definitionObjId,
        debitOrCredit,
        amount,
        fieldName: comp.componentName || comp.name || "Salary Component",
      };

      // Add totals
      debitOrCredit === "debit" ? (totalDebits += amount) : (totalCredits += amount);
      accountingLines.push(line);

      // Process mirrors recursively
      if (Array.isArray(comp.mirrors) && comp.mirrors.length) {
        await Promise.all(comp.mirrors.map(mirror => processLine(mirror, amount)));
      }

      return line;
    };

    // 4️⃣ Process all components
    await Promise.all(components.map(comp => processLine(comp)));

    // 5️⃣ Persist transaction
    const tx = await persistTransactionAndApply(accountingLines, description, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "✅ Salary transaction posted successfully",
      employeeId,
      transactionId: tx.transactionId,
      totalDebits,
      totalCredits,
      netToPay: Math.round((totalDebits - totalCredits) * 100) / 100,
      accountingLines,
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(`SalaryTransactionController Error for employee ${req.body.employeeId || req.params.employeeId}:`, err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// ----------------- Helper: get summaries with populated entries -----------------
export const getSummariesWithEntries = async (req, res) => {
  try {
    const transactions = await TransactionModel.find({})
      .populate("lines.summaryId", "name") // populate summary names
      .populate("lines.instanceId", "name"); // populate instance names (adjusted)

    const summaries = {};

    for (const tx of transactions) {
      for (const line of tx.lines) {
        const { summaryId, instanceId, debitOrCredit, amount } = line;
        if (!summaryId) continue;
        const summaryKey = summaryId._id.toString();

        if (!summaries[summaryKey]) {
          summaries[summaryKey] = {
            summaryId: summaryId._id,
            summaryName: summaryId.name,
            lines: [],
          };
        }

        const counterparties = tx.lines
          .filter(l => l !== line)
          .map(l => ({
            summaryId: l.summaryId ? l.summaryId._id : null,
            summaryName: l.summaryId ? l.summaryId.name : null,
            debitOrCredit: l.debitOrCredit,
            amount: l.amount,
          }));

        summaries[summaryKey].lines.push({
          transactionId: tx._id,
          description: tx.description,
          date: tx.date,
          fieldLineName: instanceId?.name || "",
          debitOrCredit,
          amount,
          counterparties,
        });
      }
    }

    res.json(Object.values(summaries));
  } catch (err) {
    console.error("Error in getSummariesWithEntries:", err);
    res.status(500).json({ message: "Server error" });
  }
};


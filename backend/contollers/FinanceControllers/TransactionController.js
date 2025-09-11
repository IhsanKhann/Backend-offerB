// controllers/FinanceControllers/ExpenseAndCommissionControllers.js
import mongoose from "mongoose";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineModel from "../../models/FinanceModals/SummaryFieldLinesModel.js";
import TablesModel from "../../models/FinanceModals/TablesModel.js";
import BreakupFileModel from "../../models/FinanceModals/BreakupfileModel.js";
import BreakupRuleModel from "../../models/FinanceModals/BreakupRules.js";
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";

// Summary numeric IDs
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

// compute line amount based on rule increment type
function computeLineAmount(split, baseAmount, incrementType = "both", totalPercent = 100) {
  // splits have percentage or fixedAmount
  if (!split) return 0;
  let fixed = Number(split.fixedAmount || 0);
  let perc = Number(split.percentage || 0);

  if (incrementType === "fixed") {
    return Math.round(fixed * 100) / 100;
  }

  if (incrementType === "percentage") {
    const p = (perc / (totalPercent || 100)) * baseAmount;
    return Math.round(p * 100) / 100;
  }

  // both
  const p = (perc / (totalPercent || 100)) * baseAmount;
  return Math.round((fixed + p) * 100) / 100;
}

// Helper: resolve numeric summaryId -> Summary doc and return _id
async function resolveSummaryIdToObjectId(numericSummaryId, session) {
  if (!numericSummaryId && numericSummaryId !== 0) return null;
  // numericSummaryId may already be an ObjectId; try to find by summaryId numeric index
  const summary = await SummaryModel.findOne({ summaryId: numericSummaryId }).session(session);
  if (!summary) throw new Error(`Summary with summaryId ${numericSummaryId} not found`);
  return summary._id;
}

// Helper: get summary ObjectId (existing)
async function getSummaryObjectId(numericSummaryId, session) {
  return await resolveSummaryIdToObjectId(numericSummaryId, session);
}

// Helper: get field line ObjectId
async function getFieldLineObjectId(numericFieldLineId, session) {
  if (!numericFieldLineId && numericFieldLineId !== 0) return null;
  const fieldLine = await SummaryFieldLineModel.findOne({ fieldLineId: numericFieldLineId }).session(session);
  if (!fieldLine) {
    console.warn(`[DEBUG] Field line ${numericFieldLineId} not found`);
    return null;
  }
  return fieldLine._id;
}

// get numeric balance helpers (endingBalance from Summary or balance from field line)
async function getCommissionBalance(session) {
  const doc = await SummaryModel.findOne({ summaryId: SID.COMMISSION }).session(session);
  return (doc && Number(doc.endingBalance || 0)) || 0;
}
async function getCashBalance(session) {
  const doc = await SummaryModel.findOne({ summaryId: SID.CASH }).session(session);
  return (doc && Number(doc.endingBalance || 0)) || 0;
}
async function getCapitalBalance(session) {
  const doc = await SummaryModel.findOne({ summaryId: SID.CAPITAL }).session(session);
  return (doc && Number(doc.endingBalance || 0)) || 0;
}

// Validate initial cash & capital present with non-zero starting balances
async function validateInitialCashAndCapital(session) {
  const cashSummary = await SummaryModel.findOne({ summaryId: SID.CASH }).session(session);
  const capitalSummary = await SummaryModel.findOne({ summaryId: SID.CAPITAL }).session(session);

  if (!cashSummary || !capitalSummary) {
    throw new Error("Cash or Capital summary not found. Please insert them first.");
  }

  if ((cashSummary.startingBalance || 0) <= 0 || (capitalSummary.startingBalance || 0) <= 0) {
    throw new Error("Initial Cash or Capital starting balance is zero. Please update them before posting transactions.");
  }

  return { cashSummary, capitalSummary };
}

// Create funding lines (Commission -> Cash first, then Capital -> Cash).
// Returns an array of accounting lines (to be merged with the main transaction lines and applied via updateBalances).
async function buildFundingLines(amountNeeded, session) {
  const fundingLines = [];
  amountNeeded = Math.round(Number(amountNeeded || 0) * 100) / 100;
  if (amountNeeded <= 0) return fundingLines;

  const commissionBalance = await getCommissionBalance(session);

  // Resolve object ids for summaries & field lines (prefer known fieldLine ids)
  const cashFieldObjId = await getFieldLineObjectId(5301, session); // fieldLine 5301 for Cash (if exists)
  const commissionFieldObjId = await getFieldLineObjectId(5201, session); // Commission fieldLine
  const capitalFieldObjId = await getFieldLineObjectId(5101, session); // Capital fieldLine

  const cashSummaryObj = await getSummaryObjectId(SID.CASH, session);
  const commissionSummaryObj = await getSummaryObjectId(SID.COMMISSION, session);
  const capitalSummaryObj = await getSummaryObjectId(SID.CAPITAL, session);

  let remaining = amountNeeded;

  if (commissionBalance > 0) {
    const fromCommission = Math.min(commissionBalance, remaining);
    fundingLines.push({
      summaryObjectId: cashSummaryObj,
      summaryId: SID.CASH,
      fieldLineObjectId: cashFieldObjId,
      fieldLineId: 5301,
      debitOrCredit: "debit",
      amount: fromCommission,
      fieldName: "Fund from Commission -> Cash"
    });
    fundingLines.push({
      summaryObjectId: commissionSummaryObj,
      summaryId: SID.COMMISSION,
      fieldLineObjectId: commissionFieldObjId,
      fieldLineId: 5201,
      debitOrCredit: "credit",
      amount: fromCommission,
      fieldName: "Reduce Commission (fund cash)"
    });
    remaining = Math.round((remaining - fromCommission) * 100) / 100;
  }

  if (remaining > 0.00001) {
    fundingLines.push({
      summaryObjectId: cashSummaryObj,
      summaryId: SID.CASH,
      fieldLineObjectId: cashFieldObjId,
      fieldLineId: 5301,
      debitOrCredit: "debit",
      amount: remaining,
      fieldName: "Fund from Capital -> Cash"
    });
    fundingLines.push({
      summaryObjectId: capitalSummaryObj,
      summaryId: SID.CAPITAL,
      fieldLineObjectId: capitalFieldObjId,
      fieldLineId: 5101,
      debitOrCredit: "credit",
      amount: remaining,
      fieldName: "Reduce Capital (fund cash)"
    });
    remaining = 0;
  }

  return fundingLines;
}

// Helper: apply accounting lines to summaries and field lines
async function updateBalances(accountingLines, session) {
  for (const l of accountingLines) {
    if (!l || l.debitOrCredit === "none") continue;
    const amt = l.debitOrCredit === "debit" ? Number(l.amount) : -Number(l.amount);

    // Update field line (if present)
    if (l.fieldLineObjectId) {
      // increment fieldline balance
      await SummaryFieldLineModel.findByIdAndUpdate(l.fieldLineObjectId, { $inc: { balance: amt } }, { session });
      // update parent summary endingBalance (fieldLineDoc.summaryId may be ObjectId)
      const fld = await SummaryFieldLineModel.findById(l.fieldLineObjectId).session(session);
      if (fld && fld.summaryId) {
        // fld.summaryId might be ObjectId or numeric; attempt to update by _id or by summaryId
        if (mongoose.Types.ObjectId.isValid(String(fld.summaryId))) {
          await SummaryModel.findByIdAndUpdate(fld.summaryId, { $inc: { endingBalance: amt } }, { session });
        } else {
          const parent = await SummaryModel.findOne({ summaryId: fld.summaryId }).session(session);
          if (parent) await SummaryModel.findByIdAndUpdate(parent._id, { $inc: { endingBalance: amt } }, { session });
        }
      }
    } else if (l.summaryObjectId) {
      // If we have a summaryObjectId (ObjectId), use it
      await SummaryModel.findByIdAndUpdate(l.summaryObjectId, { $inc: { endingBalance: amt } }, { session });
    } else if (l.summaryId) {
      // fallback: numeric summary id present -> find doc and update
      const sdoc = await SummaryModel.findOne({ summaryId: l.summaryId }).session(session);
      if (sdoc) {
        await SummaryModel.findByIdAndUpdate(sdoc._id, { $inc: { endingBalance: amt } }, { session });
      } else {
        console.warn(`[WARN] No summary found for numeric summaryId ${l.summaryId} while updating balances.`);
      }
    } else {
      console.warn("[WARN] Accounting line without summaryObjectId or fieldLineObjectId", l);
    }
  }
}

// ----------------- Expense Transaction -----------------
export const ExpenseTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { amount, name, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

    // Get rules from TablesModel (non-breakup rules)
    const rules = await TablesModel.find({ transactionType: "Expense Allocation" }).lean().session(session);
    if (!rules || rules.length === 0) return res.status(400).json({ error: "No Expense Allocation rules found" });

    const accountingLines = [];
    let totalExpenseRecognition = 0;

    // Recognition: split expense to expense field lines & mirror allowances
    for (const rule of rules) {
      const splits = rule.splits || [];
      const totalPercent = splits.reduce((s, sp) => s + (sp.percentage || 0), 0) || 100;

      for (const split of splits) {
        const lineAmount = computeLineAmount(split, amount, rule.incrementType, totalPercent);
        if (!lineAmount) continue;
        totalExpenseRecognition += lineAmount;

        // Dr Expense (use fieldLine if present)
        const expenseFieldObjId = await getFieldLineObjectId(split.fieldLineId, session);
        let expenseSummaryObjId = null;
        if (expenseFieldObjId) {
          const fld = await SummaryFieldLineModel.findById(expenseFieldObjId).session(session);
          if (fld && fld.summaryId) {
            expenseSummaryObjId = mongoose.Types.ObjectId.isValid(String(fld.summaryId))
              ? fld.summaryId
              : await getSummaryObjectId(fld.summaryId, session);
          } else {
            expenseSummaryObjId = await getSummaryObjectId(split.summaryId, session);
          }
        } else {
          expenseSummaryObjId = await getSummaryObjectId(split.summaryId, session);
        }

        accountingLines.push({
          summaryObjectId: expenseSummaryObjId,
          summaryId: split.summaryId,
          fieldLineObjectId: expenseFieldObjId,
          fieldLineId: split.fieldLineId,
          debitOrCredit: "debit",
          amount: lineAmount,
          fieldName: split.fieldName || `Expense ${split.fieldLineId}`
        });

        // Cr Allowance (mirror). Mirror may be specified explicitly.
        if (Array.isArray(split.mirrors) && split.mirrors.length) {
          for (const mirror of split.mirrors) {
            const mirrorFieldObjId = await getFieldLineObjectId(mirror.fieldLineId, session);
            let mirrorSummaryObjId = null;
            if (mirrorFieldObjId) {
              const mf = await SummaryFieldLineModel.findById(mirrorFieldObjId).session(session);
              mirrorSummaryObjId = (mf && mf.summaryId)
                ? (mongoose.Types.ObjectId.isValid(String(mf.summaryId)) ? mf.summaryId : await getSummaryObjectId(mf.summaryId, session))
                : await getSummaryObjectId(mirror.summaryId, session);
            } else {
              mirrorSummaryObjId = await getSummaryObjectId(mirror.summaryId, session);
            }

            accountingLines.push({
              summaryObjectId: mirrorSummaryObjId,
              summaryId: mirror.summaryId,
              fieldLineObjectId: mirrorFieldObjId,
              fieldLineId: mirror.fieldLineId,
              debitOrCredit: mirror.debitOrCredit || "credit",
              amount: lineAmount,
              fieldName: mirror.fieldName || `Allowance for ${split.fieldName}`
            });
          }
        } else {
          // fallback: if no explicit mirror, credit ALLOWANCES summary
          const allowanceSummaryObjId = await getSummaryObjectId(SID.ALLOWANCES, session);
          accountingLines.push({
            summaryObjectId: allowanceSummaryObjId,
            summaryId: SID.ALLOWANCES,
            fieldLineObjectId: null,
            fieldLineId: null,
            debitOrCredit: "credit",
            amount: lineAmount,
            fieldName: `Allowance for ${split.fieldName}`
          });
        }
      }
    } // end recognition

    // Determine cash needed: all credits to allowances + (if you pay expense directly from cash) -> for expense allocation model we pay allowances from cash
    const allowanceCreditsSum = accountingLines.filter(l => l.debitOrCredit === "credit" && (l.summaryId === SID.ALLOWANCES || (l.fieldLineId && String(l.fieldLineId).startsWith("11")))).reduce((s, l) => s + Number(l.amount || 0), 0);
    const requiredCash = Math.round(allowanceCreditsSum * 100) / 100;

    // Build funding lines (Commission -> Cash, Capital -> Cash)
    const fundingLines = await buildFundingLines(requiredCash, session);

    // Payment lines: debit Allowances, credit Cash per grouped amount
    if (requiredCash > 0) {
      // debit allowances summary (aggregate)
      accountingLines.push({
        summaryObjectId: await getSummaryObjectId(SID.ALLOWANCES, session),
        summaryId: SID.ALLOWANCES,
        fieldLineObjectId: null,
        fieldLineId: null,
        debitOrCredit: "debit",
        amount: requiredCash,
        fieldName: "Pay Allowances (bulk)"
      });

      // credit cash (use cash field line)
      const cashFieldObjId = await getFieldLineObjectId(5301, session);
      accountingLines.push({
        summaryObjectId: await getSummaryObjectId(SID.CASH, session),
        summaryId: SID.CASH,
        fieldLineObjectId: cashFieldObjId,
        fieldLineId: 5301,
        debitOrCredit: "credit",
        amount: requiredCash,
        fieldName: "Cash Payment for Allowances"
      });
    }

    // Merge funding lines into accounting lines at the front (so funding occurs before payments)
    const finalAccountingLines = [...fundingLines, ...accountingLines];

    // Persist a transaction where amount is the actual cash outflow (sum of cash credits)
    const cashCreditsTotal = finalAccountingLines.filter(l => l.summaryId === SID.CASH && l.debitOrCredit === "credit").reduce((s, l) => s + Number(l.amount || 0), 0);
    const tx = await TransactionModel.create([{
      transactionId: Date.now(),
      date: new Date(),
      description: description || name || "Expense Transaction",
      amount: Math.round(cashCreditsTotal * 100) / 100,
      lines: finalAccountingLines.map(l => ({
        fieldLineId: l.fieldLineId,
        summaryId: l.summaryId,
        debitOrCredit: l.debitOrCredit,
        amount: l.amount,
        fieldName: l.fieldName
      }))
    }], { session });

    // Apply balances
    await updateBalances(finalAccountingLines, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ message: "Expense transaction posted successfully", transactionId: tx[0].transactionId, accountingLines: finalAccountingLines });
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

    // Build accounting lines: debit Cash, credit Commission (prefer field lines)
    const cashFieldObjId = await getFieldLineObjectId(5301, session);
    const commissionFieldObjId = await getFieldLineObjectId(5201, session);
    const cashSummaryObj = await getSummaryObjectId(SID.CASH, session);
    const commissionSummaryObj = await getSummaryObjectId(SID.COMMISSION, session);

    const accountingLines = [
      {
        summaryObjectId: cashSummaryObj,
        summaryId: SID.CASH,
        fieldLineObjectId: cashFieldObjId,
        fieldLineId: 5301,
        debitOrCredit: "debit",
        amount: Math.round(Number(amount) * 100) / 100,
        fieldName: "Commission received (Cash)"
      },
      {
        summaryObjectId: commissionSummaryObj,
        summaryId: SID.COMMISSION,
        fieldLineObjectId: commissionFieldObjId,
        fieldLineId: 5201,
        debitOrCredit: "credit",
        amount: Math.round(Number(amount) * 100) / 100,
        fieldName: "Commission Income"
      }
    ];

    // Persist transaction
    const txDoc = await TransactionModel.create([{
      transactionId: Date.now(),
      date: new Date(),
      description: description || "Commission Transaction",
      amount: Math.round(Number(amount) * 100) / 100,
      lines: accountingLines.map(l => ({ fieldLineId: l.fieldLineId, summaryId: l.summaryId, debitOrCredit: l.debitOrCredit, amount: l.amount, fieldName: l.fieldName }))
    }], { session });

    // Apply balances
    await updateBalances(accountingLines, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ message: "Commission transaction posted successfully", transactionId: txDoc[0].transactionId });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("CommissionTransactionController Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// ----------------- Commission -> Retained -----------------
export const transferCommissionToRetained = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const commissionSummary = await SummaryModel.findOne({ summaryId: SID.COMMISSION }).session(session);
    const retainedFieldLine = await SummaryFieldLineModel.findOne({ fieldLineId: 5401 }).session(session);

    if (!commissionSummary) throw new Error("Commission summary not found");
    if (!retainedFieldLine) throw new Error("Retained Income field line (5401) not found");

    const retainedSummary = await SummaryModel.findById(retainedFieldLine.summaryId).session(session);
    const amount = Math.round((commissionSummary.endingBalance || 0) * 100) / 100;
    if (amount <= 0) return res.status(400).json({ error: "No commission to transfer" });

    const accountingLines = [
      {
        summaryObjectId: commissionSummary._id,
        summaryId: commissionSummary.summaryId,
        fieldLineObjectId: null,
        fieldLineId: null,
        debitOrCredit: "debit",
        amount,
        fieldName: "Close Commission → Retained"
      },
      {
        summaryObjectId: retainedSummary._id,
        summaryId: retainedSummary.summaryId,
        fieldLineObjectId: retainedFieldLine._id,
        fieldLineId: retainedFieldLine.fieldLineId,
        debitOrCredit: "credit",
        amount,
        fieldName: "Close Commission → Retained"
      }
    ];

    await TransactionModel.create([{
      transactionId: Date.now(),
      date: new Date(),
      description: "Close commission to retained income",
      amount,
      lines: accountingLines.map(l => ({ fieldLineId: l.fieldLineId, summaryId: l.summaryId, debitOrCredit: l.debitOrCredit, amount: l.amount }))
    }], { session });

    await updateBalances(accountingLines, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ message: `Transferred ${amount} commission → Retained Income`, amount });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// ----------------- Retained -> Capital -----------------
export const transferRetainedIncomeToCapital = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const retainedFieldLine = await SummaryFieldLineModel.findOne({ fieldLineId: 5401 }).session(session);
    const capitalFieldLine = await SummaryFieldLineModel.findOne({ fieldLineId: 5101 }).session(session);

    if (!retainedFieldLine || !capitalFieldLine) throw new Error("Retained Income or Capital field line not found");

    const amount = Math.round((retainedFieldLine.balance || 0) * 100) / 100;
    if (amount <= 0) return res.status(400).json({ error: "No retained income to transfer" });

    const retainedSummary = await SummaryModel.findById(retainedFieldLine.summaryId).session(session);
    const capitalSummary = await SummaryModel.findById(capitalFieldLine.summaryId).session(session);

    const accountingLines = [
      {
        summaryObjectId: retainedSummary._id,
        summaryId: retainedSummary.summaryId,
        fieldLineObjectId: retainedFieldLine._id,
        fieldLineId: retainedFieldLine.fieldLineId,
        debitOrCredit: "debit",
        amount,
        fieldName: "Transfer Retained → Capital"
      },
      {
        summaryObjectId: capitalSummary._id,
        summaryId: capitalSummary.summaryId,
        fieldLineObjectId: capitalFieldLine._id,
        fieldLineId: capitalFieldLine.fieldLineId,
        debitOrCredit: "credit",
        amount,
        fieldName: "Transfer Retained → Capital"
      }
    ];

    await TransactionModel.create([{
      transactionId: Date.now(),
      date: new Date(),
      description: "Transfer retained to capital",
      amount,
      lines: accountingLines.map(l => ({ fieldLineId: l.fieldLineId, summaryId: l.summaryId, debitOrCredit: l.debitOrCredit, amount: l.amount }))
    }], { session });

    await updateBalances(accountingLines, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ message: `Transferred ${amount} retained → capital`, amount });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// ----------------- Salary Transaction -----------------
export const SalaryTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { employeeId } = req.params;
    if (!employeeId) return res.status(400).json({ error: "employeeId is required" });

    // 1. Fetch employee
    const employee = await FinalizedEmployeeModel.findById(employeeId).session(session);
    if (!employee) throw new Error(`Employee not found: ${employeeId}`);

    // 2. Get latest breakup file
    const breakupFile = await BreakupFileModel.findOne({ employeeId })
      .sort({ createdAt: -1 })
      .session(session);
    if (!breakupFile) throw new Error(`No breakup file found for employee ${employeeId}`);

    // 3. Load breakup rule
    const salaryRule = await BreakupRuleModel.findOne({ transactionType: "Salary" }).session(session);
    if (!salaryRule || !salaryRule.splits?.length)
      throw new Error("Salary breakup rules not configured in DB");

    // 4. Validate cash & capital
    await validateInitialCashAndCapital(session);

    // === Build accounting lines ===
    const breakdown = breakupFile.calculatedBreakup?.breakdown || [];
    const accountingLines = [];
    let netPay = 0;
    let allowanceCredits = 0;

    for (const split of salaryRule.splits) {
      // Find matching item from breakup breakdown
      const calcItem = breakdown.find(
        b => b.name?.toLowerCase().trim() === split.componentName?.toLowerCase().trim()
      );
      if (!calcItem) continue;

      const amount = Math.round((calcItem.value || 0) * 100) / 100;
      if (!amount) continue;

      // Get linked summary/fieldLine
      const fieldLineObjId = await getFieldLineObjectId(split.fieldLineId, session);
      let summaryObjectId = null;

      if (fieldLineObjId) {
        const fld = await SummaryFieldLineModel.findById(fieldLineObjId).session(session);
        summaryObjectId = fld?.summaryId
          ? (mongoose.Types.ObjectId.isValid(String(fld.summaryId))
              ? fld.summaryId
              : await getSummaryObjectId(fld.summaryId, session))
          : await getSummaryObjectId(split.summaryId, session);
      } else {
        summaryObjectId = await getSummaryObjectId(split.summaryId, session);
      }

      // Main recognition line
      accountingLines.push({
        summaryObjectId,
        summaryId: split.summaryId,
        fieldLineObjectId: fieldLineObjId,
        fieldLineId: split.fieldLineId,
        debitOrCredit: split.debitOrCredit,
        amount,
        fieldName: split.componentName
      });

      // Track salary totals
      if (split.type === "allowance") allowanceCredits += amount;
      if (split.type !== "deduction" && split.type !== "terminal") netPay += amount;
      if (split.type === "deduction") netPay -= amount;
    }

    allowanceCredits = Math.round(allowanceCredits * 100) / 100;
    netPay = Math.round(netPay * 100) / 100;

    // === Funding lines ===
    const fundingLines = await buildFundingLines(allowanceCredits, session);

    // === Payment lines ===
    if (allowanceCredits > 0) {
      // Debit allowances
      accountingLines.push({
        summaryObjectId: await getSummaryObjectId(SID.ALLOWANCES, session),
        summaryId: SID.ALLOWANCES,
        debitOrCredit: "debit",
        amount: allowanceCredits,
        fieldName: "Pay Allowances (bulk)"
      });

      // Credit cash
      const cashFieldObjId = await getFieldLineObjectId(5301, session);
      accountingLines.push({
        summaryObjectId: await getSummaryObjectId(SID.CASH, session),
        summaryId: SID.CASH,
        fieldLineObjectId: cashFieldObjId,
        fieldLineId: 5301,
        debitOrCredit: "credit",
        amount: allowanceCredits,
        fieldName: "Cash Payment for Allowances"
      });
    }

    const finalAccountingLines = [...fundingLines, ...accountingLines];

    // === Persist transaction ===
    const cashCreditsTotal = finalAccountingLines
      .filter(l => l.summaryId === SID.CASH && l.debitOrCredit === "credit")
      .reduce((s, l) => s + Number(l.amount || 0), 0);

    const txDoc = await TransactionModel.create(
      [{
        transactionId: Date.now(),
        date: new Date(),
        description: `Salary Payment - Employee ${employeeId}`,
        amount: Math.round(cashCreditsTotal * 100) / 100,
        lines: finalAccountingLines.map(l => ({
          fieldLineId: l.fieldLineId,
          summaryId: l.summaryId,
          debitOrCredit: l.debitOrCredit,
          amount: l.amount,
          fieldName: l.fieldName
        }))
      }],
      { session }
    );

    // Update balances
    await updateBalances(finalAccountingLines, session);

    // Save salary details
    employee.salary.amount = netPay;
    employee.salary.salaryDetails = breakdown;
    await employee.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Salary transaction posted successfully",
      transactionId: txDoc[0].transactionId,
      netSalary: netPay,
      accountingLines: finalAccountingLines
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("SalaryTransactionController Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
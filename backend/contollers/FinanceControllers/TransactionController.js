// controllers/FinanceControllers/ExpenseAndCommissionControllers.js
import mongoose from "mongoose";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
// import SummaryFieldLineModel from "../../models/FinanceModals/SummaryFieldLinesModel.js";
import TablesModel from "../../models/FinanceModals/TablesModel.js";
import BreakupFileModel from "../../models/FinanceModals/BreakupFiles.js";
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


// Helper: increment by debit/credit
const incBySide = (side, amt) => (side === "debit" ? amt : -amt);

// Helper: get summary ObjectId
async function getSummaryObjectId(numericSummaryId, session) {
  const summary = await SummaryModel.findOne({ summaryId: numericSummaryId }).session(session);
  if (!summary) throw new Error(`Summary ${numericSummaryId} not found`);
  return summary._id;
}

// Helper: get field line ObjectId
async function getFieldLineObjectId(numericFieldLineId, session) {
  if (!numericFieldLineId) return null;
  const fieldLine = await SummaryFieldLineModel.findOne({ fieldLineId: numericFieldLineId }).session(session);
  if (!fieldLine) console.warn(`[DEBUG] Field line ${numericFieldLineId} not found`);
  return fieldLine ? fieldLine._id : null;
}

// Helper: validate initial cash and capital
async function validateInitialCashAndCapital(session) {
  const cashSummary = await SummaryModel.findOne({ summaryId: SID.CASH }).session(session);
  const capitalSummary = await SummaryModel.findOne({ summaryId: SID.CAPITAL }).session(session);

  if (!cashSummary || !capitalSummary) {
    throw new Error("Cash or Capital summary not found. Please insert them first.");
  }

  if ((cashSummary.startingBalance || 0) <= 0 || (capitalSummary.startingBalance || 0) <= 0) {
    throw new Error("Initial Cash or Capital balance is zero. Please update them before posting transactions.");
  }

  console.log("[DEBUG] Initial Cash and Capital validated successfully.");
  return { cashSummary, capitalSummary };
}

// Helper: apply accounting lines to summaries and field lines
async function updateBalances(accountingLines, session) {
  for (const l of accountingLines) {
    if (l.debitOrCredit === "none") continue;
    const amt = l.debitOrCredit === "debit" ? l.amount : -l.amount;

    // Update field line
    if (l.fieldLineObjectId) {
      await SummaryFieldLineModel.findByIdAndUpdate(l.fieldLineObjectId, { $inc: { balance: amt } }, { session });

      // Update parent summary if linked
      const fieldLineDoc = await SummaryFieldLineModel.findById(l.fieldLineObjectId).session(session);
      if (fieldLineDoc && fieldLineDoc.summaryId) {
        await SummaryModel.findByIdAndUpdate(fieldLineDoc.summaryId, { $inc: { endingBalance: amt } }, { session });
      }
    }
    // Update summary if no field line
    else if (l.summaryObjectId) {
      await SummaryModel.findByIdAndUpdate(l.summaryObjectId, { $inc: { endingBalance: amt } }, { session });
    }
  }
}

// --------------------- Expense Transaction ---------------------
export const ExpenseTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { amount, name, description } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const rules = await TablesModel.find({ transactionType: "Expense Allocation" }).lean();
    if (!rules || rules.length === 0) {
      return res.status(400).json({ error: "No Expense Allocation rules found" });
    }

    const accountingLines = [];
    let totalDebits = 0;

    // 1️⃣ Recognition: Expense debits and Allowance credits
    for (const rule of rules) {
      const splits = rule.splits || [];
      const totalPercent = splits.reduce((s, sp) => s + (sp.percentage || 0), 0) || 100;

      for (const split of splits) {
        const lineAmount = computeLineAmount(split, amount, rule.incrementType, totalPercent);
        if (!lineAmount) continue;

        // Dr Expense
        const expenseSummaryObjId = await getSummaryObjectId(split.summaryId, session);
        const expenseFieldObjId = await getFieldLineObjectId(split.fieldLineId, session);
        accountingLines.push({
          summaryObjectId: expenseSummaryObjId,
          summaryId: split.summaryId,
          fieldLineObjectId: expenseFieldObjId,
          fieldLineId: split.fieldLineId,
          debitOrCredit: "debit",
          amount: lineAmount,
          fieldName: split.fieldName,
        });
        totalDebits += lineAmount;

        // Cr Allowance (mirror)
        const allowanceFieldLineId = split.fieldLineId ? split.fieldLineId - 1000 : null; // Expense -> Allowance
        const allowanceFieldObjId = allowanceFieldLineId
          ? await getFieldLineObjectId(allowanceFieldLineId, session)
          : null;
        const allowanceSummaryObjId = await getSummaryObjectId(SID.ALLOWANCES, session);

        accountingLines.push({
          summaryObjectId: allowanceSummaryObjId,
          summaryId: SID.ALLOWANCES,
          fieldLineObjectId: allowanceFieldObjId,
          fieldLineId: allowanceFieldLineId,
          debitOrCredit: "credit",
          amount: lineAmount,
          fieldName: `Allowance for ${split.fieldName}`,
        });
      }
    }

    // 2️⃣ Funding: Commission -> Cash -> Capital
    let remainingToFund = Math.round(totalDebits * 100) / 100;

    const commissionSummaryDoc = await SummaryModel.findOne({ summaryId: SID.COMMISSION }).session(session);
    const commissionBalance = commissionSummaryDoc ? (commissionSummaryDoc.endingBalance || 0) : 0;

    const cashSummaryObjId = await getSummaryObjectId(SID.CASH, session);
    const commissionSummaryObjId = await getSummaryObjectId(SID.COMMISSION, session);
    const capitalSummaryObjId = await getSummaryObjectId(SID.CAPITAL, session);

    // Use Commission first
    if (commissionBalance > 0 && remainingToFund > 0) {
      const transferFromCommission = Math.min(commissionBalance, remainingToFund);
      accountingLines.push(
        { summaryObjectId: cashSummaryObjId, summaryId: SID.CASH, fieldLineObjectId: null, fieldLineId: null, debitOrCredit: "debit", amount: transferFromCommission, fieldName: "Fund from Commission -> Cash" },
        { summaryObjectId: commissionSummaryObjId, summaryId: SID.COMMISSION, fieldLineObjectId: null, fieldLineId: null, debitOrCredit: "credit", amount: transferFromCommission, fieldName: "Reduce Commission" }
      );
      remainingToFund = Math.round((remainingToFund - transferFromCommission) * 100) / 100;
    }

    // Remaining from Capital
    if (remainingToFund > 0.00001) {
      accountingLines.push(
        { summaryObjectId: cashSummaryObjId, summaryId: SID.CASH, fieldLineObjectId: null, fieldLineId: null, debitOrCredit: "debit", amount: remainingToFund, fieldName: "Fund from Capital -> Cash" },
        { summaryObjectId: capitalSummaryObjId, summaryId: SID.CAPITAL, fieldLineObjectId: null, fieldLineId: null, debitOrCredit: "credit", amount: remainingToFund, fieldName: "Reduce Capital" }
      );
      remainingToFund = 0;
    }

    // 3️⃣ Pay Allowances from Cash
    const allowanceCredits = accountingLines.filter(l => l.summaryId === SID.ALLOWANCES && l.debitOrCredit === "credit");
    for (const allow of allowanceCredits) {
      const payAmount = allow.amount;
      accountingLines.push(
        {
          summaryObjectId: allow.summaryObjectId,
          summaryId: SID.ALLOWANCES,
          fieldLineObjectId: allow.fieldLineObjectId,
          fieldLineId: allow.fieldLineId,
          debitOrCredit: "debit",
          amount: payAmount,
          fieldName: `Pay Allowance - ${allow.fieldName}`,
        },
        {
          summaryObjectId: cashSummaryObjId,
          summaryId: SID.CASH,
          fieldLineObjectId: null,
          fieldLineId: null,
          debitOrCredit: "credit",
          amount: payAmount,
          fieldName: `Cash Payment for Allowance - ${allow.fieldName}`,
        }
      );
    }

    // Persist transaction
    const txDoc = await TransactionModel.create(
      [{ transactionId: Date.now(), date: new Date(), description: description || name || "Expense Transaction", amount, lines: accountingLines.map(l => ({ fieldLineId: l.fieldLineId, summaryId: l.summaryId, debitOrCredit: l.debitOrCredit, amount: l.amount })) }],
      { session }
    );

    // Update balances
    await updateBalances(accountingLines, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ message: "Expense transaction posted successfully", transactionId: txDoc[0].transactionId, accountingLines });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("ExpenseTransactionController Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// --------------------- Commission Transaction ---------------------
export const CommissionTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid commission amount" });

    const cashObjId = await getSummaryObjectId(SID.CASH, session);
    const commissionObjId = await getSummaryObjectId(SID.COMMISSION, session);

    const accountingLines = [
      { summaryObjectId: cashObjId, summaryId: SID.CASH, fieldLineObjectId: null, fieldLineId: null, debitOrCredit: "debit", amount, fieldName: "Commission received (Cash)" },
      { summaryObjectId: commissionObjId, summaryId: SID.COMMISSION, fieldLineObjectId: null, fieldLineId: null, debitOrCredit: "credit", amount, fieldName: "Commission Income" }
    ];

    const txDoc = await TransactionModel.create(
      [{ transactionId: Date.now(), date: new Date(), description: description || "Commission Transaction", amount, lines: accountingLines.map(l => ({ fieldLineId: l.fieldLineId, summaryId: l.summaryId, debitOrCredit: l.debitOrCredit, amount: l.amount })) }],
      { session }
    );

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
        fieldName: "Close Commission → Retained",
      },
      {
        summaryObjectId: retainedSummary._id,
        summaryId: retainedSummary.summaryId,
        fieldLineObjectId: retainedFieldLine._id,
        fieldLineId: retainedFieldLine.fieldLineId,
        debitOrCredit: "credit",
        amount,
        fieldName: "Close Commission → Retained",
      },
    ];

    await TransactionModel.create(
      [
        {
          transactionId: Date.now(),
          date: new Date(),
          description: "Close commission to retained income",
          amount,
          lines: accountingLines.map((l) => ({
            fieldLineId: l.fieldLineId,
            summaryId: l.summaryId,
            debitOrCredit: l.debitOrCredit,
            amount: l.amount,
          })),
        },
      ],
      { session }
    );

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
        fieldName: "Transfer Retained → Capital",
      },
      {
        summaryObjectId: capitalSummary._id,
        summaryId: capitalSummary.summaryId,
        fieldLineObjectId: capitalFieldLine._id,
        fieldLineId: capitalFieldLine.fieldLineId,
        debitOrCredit: "credit",
        amount,
        fieldName: "Transfer Retained → Capital",
      },
    ];

    await TransactionModel.create(
      [
        {
          transactionId: Date.now(),
          date: new Date(),
          description: "Transfer retained to capital",
          amount,
          lines: accountingLines.map((l) => ({
            fieldLineId: l.fieldLineId,
            summaryId: l.summaryId,
            debitOrCredit: l.debitOrCredit,
            amount: l.amount,
          })),
        },
      ],
      { session }
    );

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

const safeToObjectId = (id) => {
  if (!id) return null;
  const idStr = String(id);
  return mongoose.Types.ObjectId.isValid(idStr)
    ? new mongoose.Types.ObjectId(idStr)
    : null;
};

export const SalaryTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { employeeId } = req.params;
    const { month, year } = req.body; // optional filters for breakup file
    if (!employeeId) return res.status(400).json({ error: "employeeId is required" });

    const empObjectId = safeToObjectId(employeeId);

    // --- fetch employee ---
    const employee = await FinalizedEmployeeModel.findById(empObjectId).session(session);
    if (!employee) throw new Error(`Employee not found: ${employeeId}`);

    // --- fetch latest breakup file (optionally filtered by month/year) ---
    const breakupQuery = { employeeId: empObjectId };
    if (month) breakupQuery.month = month;
    if (year) breakupQuery.year = year;

    const breakupFile = await BreakupFileModel.findOne(breakupQuery)
      .sort({ createdAt: -1 })
      .session(session);

    if (!breakupFile) {
      console.error("[DEBUG][Salary] Breakup file query:", breakupQuery);
      throw new Error(`Breakup file not found for employee ${employeeId}`);
    }

    if (breakupFile.paidAt) throw new Error(`Salary already paid for this breakup`);

    // --- fetch salary rule ---
    const salaryRule = await BreakupRuleModel.findOne({ transactionType: "Salary" }).session(session);
    if (!salaryRule || !salaryRule.splits?.length)
      throw new Error("Salary breakup rule not found in DB");

    // --- fetch non-breakup rules ---
    const commissionRule = await TablesModel.findOne({ transactionType: /Commission/i }).session(session);
    const expenseAllocationRule = await TablesModel.findOne({ transactionType: /Expense Allocation/i }).session(session);

    // --- validate core summaries ---
    await validateInitialCashAndCapital(session);
    const commissionSummaryDoc = await SummaryModel.findOne({ summaryId: SID.COMMISSION }).session(session);
    const cashSummaryObjId = await getSummaryObjectId(SID.CASH, session);
    const commissionSummaryObjId = await getSummaryObjectId(SID.COMMISSION, session);
    const capitalSummaryObjId = await getSummaryObjectId(SID.CAPITAL, session);

    // --- accounting calculations ---
    const accountingLines = [];
    let totalAllowanceCredits = 0;
    let netPay = 0;
    let recognitionTotal = 0;

    const breakdown = breakupFile.calculatedBreakup?.breakdown || [];
    for (const split of salaryRule.splits) {
      const calcItem = breakdown.find(
        b =>
          String(b.name).trim().toLowerCase() === String(split.componentName).trim().toLowerCase() &&
          b.type === split.type
      );
      if (!calcItem) continue;

      const amount = Math.round((calcItem.value || 0) * 100) / 100;
      if (!amount) continue;
      recognitionTotal += amount;

      const fieldLineObjId = await getFieldLineObjectId(split.fieldLineId, session);
      let summaryObjectId = fieldLineObjId
        ? (await SummaryFieldLineModel.findById(fieldLineObjId).session(session))?.summaryId ||
          await getSummaryObjectId(split.summaryId, session)
        : await getSummaryObjectId(split.summaryId, session);

      accountingLines.push({
        summaryObjectId,
        summaryId: split.summaryId,
        fieldLineObjectId: fieldLineObjId,
        fieldLineId: split.fieldLineId,
        debitOrCredit: split.debitOrCredit,
        amount,
        fieldName: split.componentName,
      });

      if (split.mirrors && split.mirrors.length) {
        for (const mirror of split.mirrors) {
          const mirrorFieldObjId = await getFieldLineObjectId(mirror.fieldLineId, session);
          let mirrorSummaryObjId = mirrorFieldObjId
            ? (await SummaryFieldLineModel.findById(mirrorFieldObjId).session(session))?.summaryId ||
              await getSummaryObjectId(mirror.summaryId, session)
            : await getSummaryObjectId(mirror.summaryId, session);

          accountingLines.push({
            summaryObjectId: mirrorSummaryObjId,
            summaryId: mirror.summaryId,
            fieldLineObjectId: mirrorFieldObjId,
            fieldLineId: mirror.fieldLineId,
            debitOrCredit: mirror.debitOrCredit,
            amount,
            fieldName: `Mirror for ${split.componentName}`,
          });

          if (mirror.summaryId === SID.ALLOWANCES && mirror.debitOrCredit === "credit") {
            totalAllowanceCredits += amount;
          }
        }
      }

      if (split.type === "allowance") netPay += amount;
      if (split.type === "deduction") netPay -= amount;
    }

    totalAllowanceCredits = Math.round(totalAllowanceCredits * 100) / 100;
    netPay = Math.round(netPay * 100) / 100;

    // --- FUNDING logic ---
    const commissionBalance = Math.round((commissionSummaryDoc?.endingBalance || 0) * 100) / 100;
    const commissionFieldObjId = await getFieldLineObjectId(5201, session);
    const cashFieldObjId = await getFieldLineObjectId(5301, session);
    const capitalFieldObjId = await getFieldLineObjectId(5101, session);

    const cashSummaryObj = await getSummaryObjectId(SID.CASH, session);
    const commissionSummaryObj = await getSummaryObjectId(SID.COMMISSION, session);
    const capitalSummaryObj = await getSummaryObjectId(SID.CAPITAL, session);

    let requiredCash = Math.round((Math.abs(totalAllowanceCredits) + Math.max(0, netPay)) * 100) / 100;
    let remainingToFund = requiredCash;

    if (remainingToFund > 0) {
      if (commissionBalance > 0) {
        const fromCommission = Math.min(commissionBalance, remainingToFund);
        accountingLines.push({
          summaryObjectId: cashSummaryObj,
          summaryId: SID.CASH,
          fieldLineObjectId: cashFieldObjId,
          fieldLineId: 5301,
          debitOrCredit: "debit",
          amount: fromCommission,
          fieldName: "Fund from Commission -> Cash",
        });
        accountingLines.push({
          summaryObjectId: commissionSummaryObj,
          summaryId: SID.COMMISSION,
          fieldLineObjectId: commissionFieldObjId,
          fieldLineId: 5201,
          debitOrCredit: "credit",
          amount: fromCommission,
          fieldName: "Reduce Commission (fund cash)",
        });
        remainingToFund = Math.round((remainingToFund - fromCommission) * 100) / 100;
      }
      if (remainingToFund > 0.00001) {
        accountingLines.push({
          summaryObjectId: cashSummaryObj,
          summaryId: SID.CASH,
          fieldLineObjectId: cashFieldObjId,
          fieldLineId: 5301,
          debitOrCredit: "debit",
          amount: remainingToFund,
          fieldName: "Fund from Capital -> Cash",
        });
        accountingLines.push({
          summaryObjectId: capitalSummaryObj,
          summaryId: SID.CAPITAL,
          fieldLineObjectId: capitalFieldObjId,
          fieldLineId: 5101,
          debitOrCredit: "credit",
          amount: remainingToFund,
          fieldName: "Reduce Capital (fund cash)",
        });
        remainingToFund = 0;
      }
    }

    // --- PAYMENTS ---
    if (totalAllowanceCredits > 0) {
      const allowanceSummaryObj = await getSummaryObjectId(SID.ALLOWANCES, session);
      accountingLines.push({
        summaryObjectId: allowanceSummaryObj,
        summaryId: SID.ALLOWANCES,
        fieldLineObjectId: null,
        fieldLineId: null,
        debitOrCredit: "debit",
        amount: totalAllowanceCredits,
        fieldName: "Pay Allowances (bulk)",
      });
      accountingLines.push({
        summaryObjectId: cashSummaryObj,
        summaryId: SID.CASH,
        fieldLineObjectId: cashFieldObjId,
        fieldLineId: 5301,
        debitOrCredit: "credit",
        amount: totalAllowanceCredits,
        fieldName: "Cash Payment for Allowances",
      });
    }

    if (netPay > 0) {
      const salaryFieldObjId = await getFieldLineObjectId(4101, session);
      const salarySummaryObj = salaryFieldObjId
        ? (await SummaryFieldLineModel.findById(salaryFieldObjId).session(session))?.summaryId
        : await getSummaryObjectId(SID.SALARIES, session);

      accountingLines.push({
        summaryObjectId: salarySummaryObj,
        summaryId: SID.SALARIES,
        fieldLineObjectId: salaryFieldObjId,
        fieldLineId: 4101,
        debitOrCredit: "debit",
        amount: netPay,
        fieldName: "Pay Net Salary to Employee",
      });
      accountingLines.push({
        summaryObjectId: cashSummaryObj,
        summaryId: SID.CASH,
        fieldLineObjectId: cashFieldObjId,
        fieldLineId: 5301,
        debitOrCredit: "credit",
        amount: netPay,
        fieldName: "Cash Payment - Net Salary",
      });
    }

    // --- persist transaction ---
    const txDoc = await TransactionModel.create(
      [{
        transactionId: Date.now(),
        date: new Date(),
        description: `Salary Payment - Employee ${employeeId}`,
        amount: Math.round(recognitionTotal * 100) / 100,
        lines: accountingLines.map(l => ({
          fieldLineId: l.fieldLineId,
          summaryId: l.summaryId,
          debitOrCredit: l.debitOrCredit,
          amount: l.amount,
          fieldName: l.fieldName,
        })),
      }],
      { session }
    );

    await updateBalances(accountingLines, session);

    // --- save employee salary details ---
    employee.salary.amount = Math.round((breakupFile.calculatedBreakup.netSalary || netPay || 0) * 100) / 100;
    employee.salary.terminalBenefits = (breakupFile.calculatedBreakup.breakdown || [])
      .filter(b => b.type === "terminal")
      .map(b => b.name);
    employee.salary.salaryDetails = breakupFile.calculatedBreakup.breakdown || [];
    await employee.save({ session });

    // --- mark breakup file as paid ---
    breakupFile.paidAt = new Date();
    await breakupFile.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Salary transaction posted successfully",
      transactionId: txDoc[0].transactionId,
      netSalary: employee.salary.amount,
      accountingLines,
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("SalaryTransactionController Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
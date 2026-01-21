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
import RuleModel from "../../models/FinanceModals/TablesModel.js";

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

export const resolveInstanceForEntry = async(entry, session = null) => {
  if (entry.instanceId) return safeToObjectId(entry.instanceId);


  if (entry.definitionId) {
    const inst = await SummaryFieldLineInstance.findOne({ definitionId: safeToObjectId(entry.definitionId) }).session(session);
    if (inst) return inst._id;
  }
  return null;
}

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
    const def = await SummaryFieldLineDefinition.findOne({ fieldLineNumericId: entry.fieldLineId }).session(session);
    if (def) return def._id;
  }
  return null;
}

export function computeLineAmount(split, baseAmount = 0, incrementType = "both", totalPercent = 100) {
  const fixed = Number(split.fixedAmount || 0);
  const perc = Number(split.percentage || 0);

  if (incrementType === "fixed") return fixed;
  if (incrementType === "percentage") return (perc / (totalPercent || 100)) * baseAmount;
  return fixed + (perc / (totalPercent || 100)) * baseAmount;
}

export function buildLine({ instanceId, summaryId, definitionId, debitOrCredit, amount, description, isReflection }) {
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

export const applyBalanceChange = async ({ instanceId, summaryId, debitOrCredit, amount }, session = null) => {
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
};

// ----------------- persistTransactionAndApply -----------------
export const persistTransactionAndApply = async (
  accountingLines = [],
  description = "Transaction",
  session
) => {
  if (!Array.isArray(accountingLines) || !accountingLines.length) {
    throw new Error("❌ No accounting lines provided");
  }

  if (!session) {
    throw new Error("❌ MongoDB session is required");
  }

  // ---------------- VALIDATE & NORMALIZE ----------------
  const normalizedLines = accountingLines.map((l, index) => {
    if (!l.debitOrCredit || !["debit", "credit"].includes(l.debitOrCredit)) {
      throw new Error(`❌ Invalid debitOrCredit at line ${index + 1}`);
    }

    const amount = Number(l.amount);
    if (!amount || amount <= 0) {
      throw new Error(`❌ Invalid amount at line ${index + 1}`);
    }

    return {
      employeeId: l.employeeId || null,
      instanceId: l.instanceObjectId || null,
      summaryId: l.summaryObjectId || null,
      definitionId: l.definitionObjectId || null,
      debitOrCredit: l.debitOrCredit,
      amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
      description: l.fieldName || "",
      isReflection: !!l.isReflection,
    };
  });

  // ---------------- CREATE TRANSACTION ----------------
  const totalAmount = normalizedLines.reduce(
    (sum, l) => sum + Number(l.amount),
    0
  );

  const [transaction] = await TransactionModel.create(
    [
      {
        date: new Date(),
        description,
        type: "journal",
        amount: mongoose.Types.Decimal128.fromString(
          totalAmount.toFixed(2)
        ),
        status: "posted",
        lines: normalizedLines,
      },
    ],
    { session }
  );

  // ---------------- APPLY BALANCES ----------------
  for (const line of normalizedLines) {
    await applyBalanceChange(
      {
        instanceId: line.instanceId,
        summaryId: line.summaryId,
        debitOrCredit: line.debitOrCredit,
        amount: Number(line.amount),
      },
      session
    );
  }

  return {
    transactionId: transaction._id,
    transaction,
  };
};

export const SID = {
  CAPITAL: 1600,
  CASH: 1500,
};

// ================== Expense Controllers ==================
export const ExpensePayLaterController = async (req, res) => {
  console.log("\n================ EXPENSE PAY LATER REQUEST ================");
  console.log("Incoming Body:", req.body);
  console.log("User ID:", req.user?._id);

  try {
    const tx = await postExpenseTransaction({
      amount: req.body.amount,
      description: req.body.description,
      user: req.user,
      transactionType: "EXPENSE_PAY_LATER"
    });

    console.log("✅ Expense Pay Later Transaction Created:", tx._id);

    res.status(201).json({
      message: "Expense recorded as payable",
      transactionId: tx._id
    });
  } catch (err) {
    console.error("❌ ExpensePayLaterController Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const ExpensePayNowController = async (req, res) => {
  console.log("\n================ EXPENSE PAY NOW REQUEST ================");
  console.log("Incoming Body:", req.body);
  console.log("User ID:", req.user?._id);

  try {
    const tx = await  postExpenseTransaction({
      amount: req.body.amount,
      description: req.body.description,
      user: req.user,
      transactionType: "EXPENSE_PAY_NOW"
    });

    console.log("✅ Expense Pay Now Transaction Created:", tx._id);

    res.status(201).json({
      message: "Expense paid successfully",
      transactionId: tx._id
    });
  } catch (err) {
    console.error("❌ ExpensePayNowController Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================== Core Transaction Logic ==================
export const postExpenseTransaction = async ({
  amount,
  transactionType,
  description,
  user
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  console.log("\n========== POST EXPENSE TRANSACTION ==========");
  console.log("TransactionType:", transactionType);
  console.log("Raw Amount:", amount);
  console.log("Description:", description);
  console.log("User ID:", user?._id);

  try {
    // ---------------- VALIDATION ----------------
    const baseAmount = Number(amount);
    console.log("Parsed Base Amount:", baseAmount);

    if (!baseAmount || baseAmount <= 0) {
      throw new Error("Invalid expense amount");
    }

    // ---------------- FETCH RULE ----------------
    console.log("\nFetching Expense Rule…");

    const rule = await RuleModel.findOne({ transactionType })
      .session(session)
      .lean();

    if (!rule) throw new Error(`Expense rule not found: ${transactionType}`);

    console.log("✅ Rule Found:", {
      transactionType: rule.transactionType,
      incrementType: rule.incrementType,
      splitsCount: rule.splits?.length
    });
    // console.log("Full Rule Object:", JSON.stringify(rule, null, 2));

    // ---------------- BUILD TRANSACTION LINES ----------------
    const transactionLines = [];
    const splits = rule.splits || [];
    const totalPercent = splits.reduce((sum, sp) => sum + (Number(sp.percentage) || 0), 0) || 100;

    console.log("Total Split Percentage:", totalPercent);

    for (const split of splits) {
      console.log("\n--- Processing Split ---");
      console.log("Split Config:", JSON.stringify(split, null, 2));

      const splitAmount = computeLineAmount(split, baseAmount, rule.incrementType, totalPercent);
      console.log("Computed Split Amount:", splitAmount);

      if (!splitAmount) {
        console.log("⚠️ Split skipped (amount = 0)");
        continue;
      }

      // Resolve IDs
      const instanceId = split.instanceId || (await resolveInstanceForEntry(split, session));
      const summaryId = split.summaryId || (await resolveSummaryIdForEntry(split, session));
      const definitionId = split.definitionId || (await resolveDefinitionIdForEntry(split, session));

      // console.log("Resolved IDs for Split:", { instanceId, summaryId, definitionId });

      if (!instanceId || !summaryId || !definitionId) {
        throw new Error(`Unresolved accounting IDs for split: ${split.fieldName}`);
      }

      const splitLine = buildLine({
        instanceId,
        summaryId,
        definitionId,
        debitOrCredit: split.debitOrCredit,
        amount: splitAmount,
        description: split.fieldName,
        isReflection: !!split.isReflection
      });

      console.log("✅ Split Line Built:", JSON.stringify(splitLine, null, 2));
      transactionLines.push(splitLine);

      // ---------------- PROCESS MIRRORS ----------------
      if (Array.isArray(split.mirrors)) {
        console.log(`Processing ${split.mirrors.length} mirrors for split "${split.fieldName}"`);

        for (const mirror of split.mirrors) {
          console.log("→ Mirror Config:", JSON.stringify(mirror, null, 2));

          // Resolve IDs for mirror
          const mi = mirror.instanceId || (await resolveInstanceForEntry(mirror, session));
          const ms = mirror.summaryId || (await resolveSummaryIdForEntry(mirror, session));
          const md = mirror.definitionId || (await resolveDefinitionIdForEntry(mirror, session));

          // console.log("Resolved Mirror IDs:", { mi, ms, md });

          if (!mi || !ms || !md) {
            console.warn("⚠️ Mirror skipped — unresolved IDs");
            continue;
          }

          const mirrorLine = buildLine({
            instanceId: mi,
            summaryId: ms,
            definitionId: md,
            debitOrCredit: mirror.debitOrCredit,
            amount: splitAmount,
            description: mirror.fieldName || `${split.fieldName} Mirror`,
            isReflection: !!mirror.isReflection
          });

          console.log("✅ Mirror Line Built:", JSON.stringify(mirrorLine, null, 2));
          transactionLines.push(mirrorLine);
        }
      }
    }

    if (!transactionLines.length) throw new Error("No transaction lines generated");
    console.log("\nTotal Transaction Lines Generated:", transactionLines.length);

    // ---------------- CREATE TRANSACTION ----------------
    console.log("\nCreating Transaction in DB…");

    const isPaid = transactionType === "EXPENSE_PAY_NOW";

    const [tx] = await TransactionModel.create([{
      date: new Date(),
      description,
      type: "expense",
      amount: mongoose.Types.Decimal128.fromString(baseAmount.toFixed(2)),
      createdBy: user?._id || null,
      status: "posted",
      expenseDetails: {
        isReported: false,
        isPaid,           // Use variable
        isPaidAt: isPaid ? new Date() : null
      },
      lines: transactionLines
    }], { session });

    console.log("✅ Transaction Created with ID:", tx._id);

    // ---------------- APPLY BALANCES ----------------
    console.log("\nApplying Balance Changes...");

    for (const line of transactionLines) {
      console.log("Applying Balance:", {
            instanceId: line.instanceId,
            summaryId: line.summaryId,
            debitOrCredit: line.debitOrCredit,
            amount: Number(line.amount),
            isReflection: line.isReflection
        });

        await applyBalanceChange({
            instanceId: line.instanceId,
            summaryId: line.summaryId,
            debitOrCredit: line.debitOrCredit,
            amount: Number(line.amount)
        }, session);
    }

    await session.commitTransaction();
    console.log("🎉 Transaction Committed Successfully");

    return tx;

  } catch (err) {
    console.error("❌ postExpenseTransaction FAILED:", err.message);
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
    console.log("🔒 Session Closed");
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

/**
 * Initialize capital & cash summaries
 */

export const summariesInitCapitalCash = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { amount } = req.body;

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Opening amount must be a positive number",
      });
    }

    console.log("[DEBUG] Starting initialization of opening balances. Amount:", amount);

    await session.withTransaction(async () => {
      // 1️⃣ Load the rule for opening balances
      const rule = await RuleModel.findOne({
        transactionType: "Starting Cash And Capital Balances",
      }).session(session);

      if (!rule) throw new Error("Opening balance rule not found");

      console.log("[DEBUG] Opening balance rule loaded:", rule._id, "with splits:", rule.splits.length);

      // 2️⃣ Create the main transaction
      const transaction = new TransactionModel({
        type: "opening",
        description: "Starting Cash And Capital Balances",
        amount,
        status: "posted",
        lines: [],
      });

      // 3️⃣ Process splits
      for (const [index, split] of rule.splits.entries()) {
        console.log(`[DEBUG] Processing split #${index + 1}:`, split.componentName || "undefined");

        const instanceId = await resolveInstanceForEntry(split, session);
        const summaryId = await resolveSummaryIdForEntry(split, session);
        const definitionId = await resolveDefinitionIdForEntry(split, session);

        if (!instanceId) throw new Error(`Could not resolve instance for split ${split.componentName}`);

        const splitAmount = computeLineAmount(split, amount, "both");
        console.log(`[DEBUG] Computed split amount: ${splitAmount}`);

        // Build primary line
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
        console.log(`[DEBUG] Primary line added for instance ${instanceId}`);

        // Apply balance updates
        await applyBalanceChange({
          instanceId,
          summaryId,
          debitOrCredit: split.debitOrCredit,
          amount: splitAmount,
        }, session);

        console.log(`[DEBUG] Updated balance for instance ${instanceId}`);

        // Process mirror lines
        if (split.mirrors?.length) {
          for (const [mIndex, mirror] of split.mirrors.entries()) {
            const mirrorInstanceId = await resolveInstanceForEntry(mirror, session);
            const mirrorSummaryId = await resolveSummaryIdForEntry(mirror, session);
            const mirrorDefinitionId = await resolveDefinitionIdForEntry(mirror, session);

            if (!mirrorInstanceId) throw new Error(`Could not resolve mirror instance for split ${split.componentName}`);

            const mirrorLine = buildLine({
              instanceId: mirrorInstanceId,
              summaryId: mirrorSummaryId,
              definitionId: mirrorDefinitionId,
              debitOrCredit: mirror.debitOrCredit,
              amount: splitAmount,
              description: "Opening Balance (Mirror)",
              isReflection: mirror.isReflection ?? false,
            });

            transaction.lines.push(mirrorLine);
            console.log(`[DEBUG] Mirror line added for instance ${mirrorInstanceId}`);

            await applyBalanceChange({
              instanceId: mirrorInstanceId,
              summaryId: mirrorSummaryId,
              debitOrCredit: mirror.debitOrCredit,
              amount: splitAmount,
            }, session);

            console.log(`[DEBUG] Updated balance for mirror instance ${mirrorInstanceId}`);
          }
        }
      }

      // 4️⃣ Save the transaction
      await transaction.save({ session });
      console.log("[DEBUG] Transaction saved successfully:", transaction._id);
    });

    session.endSession();
    console.log("[DEBUG] Session ended successfully");

    return res.status(200).json({
      success: true,
      message: "Opening cash and capital balances initialized successfully",
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

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

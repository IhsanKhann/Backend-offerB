// models/FinanceModels/TransactionModel.js
import mongoose from "mongoose";

/* ---------------- Transaction Line ---------------- */
const TransactionLineSchema = new mongoose.Schema({
  instanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SummaryFieldLineInstance",
    required: true
  },
  summaryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Summary",
    required: true
  },
  definitionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SummaryFieldLineDefinition",
    required: true
  },
  debitOrCredit: {
    type: String,
    enum: ["debit", "credit"],
    required: true
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true
  },
  description: String,
  isReflection: { type: Boolean, default: false }
});

/* ---------------- Order / Commission Lifecycle ---------------- */
const OrderDetailsSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  orderDeliveredAt: Date,

  // Layer-2 (Return expiry → Commission eligible)
  returnExpiryDate: Date,
  expiryReached: { type: Boolean, default: false },
  readyForRetainedEarning: { type: Boolean, default: false },

  // Layer-3 (Period lock)
  retainedLocked: { type: Boolean, default: false },
  retainedLockedAt: Date,
  retainedPeriodKey: String
});

/* ---------------- Expense Lifecycle ---------------- */
const ExpenseDetailsSchema = new mongoose.Schema({
  isExpense: { type: Boolean, default: false },

  // unpaid → cleared during commission close
  isCleared: { type: Boolean, default: false },
  clearedAt: Date,
  clearedPeriodKey: String
});

/* ---------------- Main Transaction ---------------- */
const TransactionSchema = new mongoose.Schema({
  transactionId: { type: Number, unique: true },

  date: { type: Date, default: Date.now },
  description: String,

  type: {
    type: String,
    enum: ["salary", "purchase", "sale", "journal", "transfer", "expense"],
    default: "journal"
  },

  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  status: {
    type: String,
    enum: ["draft", "posted", "cancelled"],
    default: "posted"
  },

  totalDebits: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  totalCredits: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  isBalanced: { type: Boolean, default: false },

  lines: [TransactionLineSchema],

  // Modular lifecycles
  orderDetails: OrderDetailsSchema,
  expenseDetails: ExpenseDetailsSchema,

  commissionReportId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "CommissionReport"
}

});

/* ---------------- Auto Totals ---------------- */
TransactionSchema.pre("save", function (next) {
  let debitSum = 0;
  let creditSum = 0;

  this.lines.forEach(line => {
    if (line.isReflection) return;
    const amt = parseFloat(line.amount.toString());
    if (line.debitOrCredit === "debit") debitSum += amt;
    if (line.debitOrCredit === "credit") creditSum += amt;
  });

  this.totalDebits = mongoose.Types.Decimal128.fromString(debitSum.toFixed(2));
  this.totalCredits = mongoose.Types.Decimal128.fromString(creditSum.toFixed(2));
  this.isBalanced = Math.abs(debitSum - creditSum) < 0.01;

  next();
});

export default mongoose.model("Transaction", TransactionSchema);

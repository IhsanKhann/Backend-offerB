// models/FinanceModals/TransactionModel.js
// Phase 2 Hardening — Findings addressed: F-01, F-04, F-05, F-13
//
// F-01 — All monetary fields are integer Number (minor units / paise). No Decimal128.
// F-04 — `currency` field added at both transaction and line level.
// F-05 — pre-save balance hook uses strict integer equality for isBalanced.
// F-13 — transactionId auto-generated via atomic Counter.$inc (no race condition).
import mongoose from "mongoose";
import Counter from "../HRModals/Counter.model.js";

/* ─────────────────────────────────────────────────
   Transaction Line
   F-01: amount is integer Number (minor units)
   F-04: per-line currency for multi-currency support
───────────────────────────────────────────────── */
const TransactionLineSchema = new mongoose.Schema({
  instanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SummaryFieldLineInstance",
    required: false
  },
  summaryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Summary",
    required: false
  },
  definitionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SummaryFieldLineDefinition",
    required: false
  },

  debitOrCredit: {
    type: String,
    enum: ["debit", "credit"],
    required: true
  },

  // F-01: integer minor units (paise/cents) — NO Decimal128, NO float
  amount: { type: Number, required: true },

  // F-04: per-line currency
  currency: { type: String, default: "PKR" },

  description: String,

  // F-03: reflection lines are excluded from balance totals
  isReflection: { type: Boolean, default: false }
});

/* ─────────────────────────────────────────────────
   Order / Commission Lifecycle
───────────────────────────────────────────────── */
const OrderDetailsSchema = new mongoose.Schema({
  orderId:                 { type: String, required: true },
  businessOrderId:         { type: String, index: true },

  orderDeliveredAt:        Date,
  returnExpiryDate:        Date,
  expiryReached:           { type: Boolean, default: false },
  readyForRetainedEarning: { type: Boolean, default: true },

  isReported:              { type: Boolean, default: false },
  retainedLocked:          { type: Boolean, default: false },
  retainedLockedAt:        Date,
  retainedPeriodKey:       String,
});

/* ─────────────────────────────────────────────────
   Expense Lifecycle
───────────────────────────────────────────────── */
const ExpenseDetailsSchema = new mongoose.Schema({
  includedInPnL: { type: Boolean, default: false },

  isPaid:        { type: Boolean, default: false },
  isPaidAt:      Date,
  paidPeriodKey: String,

  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FinalizedEmployee"
  }
});

/* ─────────────────────────────────────────────────
   Main Transaction Schema
   F-01: all monetary fields are integer Number
   F-04: top-level currency field
───────────────────────────────────────────────── */
const TransactionSchema = new mongoose.Schema(
  {
    // F-13: populated atomically via Counter pre-save hook
    transactionId: { type: Number, unique: true },

    date:        { type: Date, default: Date.now },
    description: String,

    type: {
      type: String,
      enum: ["salary", "purchase", "sale", "journal", "transfer", "expense", "opening"],
      default: "journal"
    },

    // F-01: integer minor units — NOT Decimal128, NOT float
    amount:    { type: Number, required: true },

    // F-04: ISO currency code
    currency:  { type: String, required: true, default: "PKR" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "FinalizedEmployee" },

    status: {
      type: String,
      enum: ["draft", "posted", "cancelled"],
      default: "posted"
    },

    // F-01: integer totals — computed in pre-save hook
    totalDebits:  { type: Number, default: 0 },
    totalCredits: { type: Number, default: 0 },

    // F-05: exact boolean — no tolerance band
    isBalanced: { type: Boolean, default: false },

    lines: [TransactionLineSchema],

    // Modular lifecycles
    orderDetails:   OrderDetailsSchema,
    expenseDetails: ExpenseDetailsSchema,

    // F-01: integer minor units
    commissionAmount: { type: Number, default: 0 },

    commissionDetails: [
      {
        componentName: String,
        // F-01: integer minor units
        amount:        { type: Number },
        instanceId:    mongoose.Schema.Types.ObjectId,
        summaryId:     mongoose.Schema.Types.ObjectId,
        definitionId:  mongoose.Schema.Types.ObjectId,
      }
    ],

    commissionReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommissionReport"
    }
  },
  { versionKey: false }
);

/* ─────────────────────────────────────────────────
   Pre-save Hook 1: Atomic transactionId (F-13)
   Uses Counter.$inc so concurrent saves never
   produce duplicate IDs.
───────────────────────────────────────────────── */
TransactionSchema.pre("save", async function (next) {
  if (this.isNew && !this.transactionId) {
    const counter = await Counter.findByIdAndUpdate(
      "transactionId",
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session: this.$session() }
    );
    this.transactionId = counter.seq;
  }
  next();
});

/* ─────────────────────────────────────────────────
   Pre-save Hook 2: Integer totals + exact balance (F-05)
   F-03/F-14: reflection lines are EXCLUDED from totals.
   F-05: isBalanced uses === (strict integer equality),
         not Math.abs(...) < 0.01 (floating-point tolerance).
───────────────────────────────────────────────── */
TransactionSchema.pre("save", function (next) {
  let debitSum  = 0;
  let creditSum = 0;

  this.lines.forEach(line => {
    // F-03: reflection lines must NEVER affect balance totals
    if (line.isReflection) return;

    const amt = line.amount; // already integer Number — no parseFloat needed
    if (line.debitOrCredit === "debit")   debitSum  += amt;
    if (line.debitOrCredit === "credit")  creditSum += amt;
  });

  // F-01: store as integer Number (not Decimal128)
  this.totalDebits  = debitSum;
  this.totalCredits = creditSum;

  // F-05: strict integer equality — no floating-point tolerance band
  this.isBalanced = (debitSum === creditSum);

  next();
});

export default mongoose.model("Transaction", TransactionSchema);
// models/FinanceModals/SalaryBreakupModel.js
// Phase 2 Refactor — Addresses: F-16
//
// Changes from original:
//   F-16 — All monetary Number fields documented as integer minor units (paise)
//   F-16 — Added `currency` to SalaryRulesSchema and CalculatedBreakupSchema (PRD §I)
//   F-16 — paymentStatus field added for lifecycle clarity
import mongoose from "mongoose";

/* ── Breakdown line ── */
const BreakdownSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    category: {
      type: String,
      enum: ["base", "allowance", "deduction", "terminal", "net"],
      required: true
    },
    // F-16: integer minor units (paise)
    value:          { type: Number, required: true },
    calculation:    { type: String, required: true },
    excludeFromTotals: { type: Boolean, default: false }
  },
  { _id: false }
);

/* ── Calculated totals ── */
const CalculatedBreakupSchema = new mongoose.Schema(
  {
    breakdown: { type: [BreakdownSchema], default: [] },

    // F-16: integer minor units
    totalAllowances: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netSalary:       { type: Number, default: 0 },

    // F-16 / PRD §I
    currency: { type: String, default: "PKR" }
  },
  { _id: false }
);

/* ── Salary component (allowance / deduction / terminal) ── */
const ComponentSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true },
    type:  { type: String, enum: ["fixed", "percentage"], required: true },
    // F-16: stored as integer minor units when type === "fixed";
    //       as a percentage integer (e.g. 10 = 10%) when type === "percentage"
    value: { type: Number, required: true }
  },
  { _id: false }
);

/* ── Salary rules snapshot ── */
const SalaryRulesSchema = new mongoose.Schema(
  {
    // F-16: integer minor units (paise)
    baseSalary:  { type: Number, required: true },
    salaryType:  { type: String, enum: ["monthly", "hourly"], default: "monthly" },

    // F-16 / PRD §I
    currency: { type: String, default: "PKR" },

    allowances:       { type: [ComponentSchema], default: [] },
    deductions:       { type: [ComponentSchema], default: [] },
    terminalBenefits: { type: [ComponentSchema], default: [] }
  },
  { _id: false }
);

/* ── Main breakup file ── */
const BreakupFileSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinalizedEmployee",
      required: true
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true
    },

    salaryRules:       SalaryRulesSchema,
    calculatedBreakup: { type: CalculatedBreakupSchema, default: {} },

    month: { type: String, required: true },
    year:  { type: Number, required: true },

    paidFor: String,   // human-readable label, e.g. "January 2025"

    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending"
    },

    paidAt: { type: Date, default: Date.now },

    // Auto-populated in pre-save
    paidMonth: String,
    paidYear:  Number,
    paidTime:  String,

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinalizedEmployee"
    }
  },
  { timestamps: true }
);

/* ── Auto-fill formatted month/year/time ── */
BreakupFileSchema.pre("save", function (next) {
  const date = this.paidAt || new Date();
  this.paidMonth = date.toLocaleString("en-US", { month: "long" });
  this.paidYear  = date.getFullYear();
  this.paidTime  = date.toLocaleTimeString("en-US");
  next();
});

export default mongoose.models.SalaryBreakupfiles ||
  mongoose.model("SalaryBreakupfiles", BreakupFileSchema);
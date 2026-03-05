// models/FinanceModals/SalaryBreakupModel.js
// Phase 2 Hardening — Findings addressed: F-16
//
// F-16 — All monetary Number fields documented as integer minor units (paise).
// F-16 — `currency` added to SalaryRulesSchema and CalculatedBreakupSchema.
// F-16 — `paymentStatus` lifecycle field added.
// FIX  — `paidAt` no longer defaults at document creation; it is only set
//         when paymentStatus transitions to "paid", so pending breakups do
//         not falsely report a paid timestamp.
import mongoose from "mongoose";

/* ── Breakdown line ── */
const BreakdownSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ["base", "allowance", "deduction", "terminal", "net"],
      required: true
    },
    // F-16: integer minor units (paise)
    value:             { type: Number, required: true },
    calculation:       { type: String, required: true },
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

    // F-16 / PRD §I: ISO currency code
    currency: { type: String, default: "PKR" }
  },
  { _id: false }
);

/* ── Salary component (allowance / deduction / terminal) ── */
const ComponentSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true },
    type:  { type: String, enum: ["fixed", "percentage"], required: true },
    // F-16: integer minor units when type === "fixed";
    //       percentage integer (e.g. 10 = 10%) when type === "percentage"
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

    // F-16 / PRD §I: ISO currency code
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

    // F-16: lifecycle clarity — default is "pending"
    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending"
    },

    // FIX (audit C-05 / M-05): paidAt has NO default.
    // It is set explicitly only when paymentStatus transitions to "paid".
    // Pending breakups must never carry a false paid timestamp.
    paidAt: { type: Date },

    // Auto-populated in pre-save — only when paidAt is present
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

/* ── Auto-fill formatted month/year/time — only when paidAt is set ── */
BreakupFileSchema.pre("save", function (next) {
  if (this.paidAt) {
    const date = this.paidAt;
    this.paidMonth = date.toLocaleString("en-US", { month: "long" });
    this.paidYear  = date.getFullYear();
    this.paidTime  = date.toLocaleTimeString("en-US");
  }
  next();
});

export default mongoose.models.SalaryBreakupfiles ||
  mongoose.model("SalaryBreakupfiles", BreakupFileSchema);
import mongoose from "mongoose";

// Reusable Benefit schema
const BenefitSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["fixed", "percentage"], required: true },
  value: { type: Number, required: true },
}, { _id: false });

// Salary Rules schema
const SalaryRulesSchema = new mongoose.Schema({
  baseSalary: { type: Number, required: true },
  salaryType: { type: String, enum: ["monthly", "hourly"], default: "monthly" },
  terminalBenefits: [BenefitSchema],
  deductions: [BenefitSchema],
  allowances: [BenefitSchema],
}, { _id: false });

// Breakdown schema for calculated salary
const BreakupDetailSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "House Rent Allowance"
  type: { type: String, enum: ["allowance", "deduction", "terminal"], required: true },
  value: { type: Number, required: true },
  calculation: { type: String }, // optional e.g., "5% of base salary"
}, { _id: false });

// Final BreakupFile schema
const BreakupFileSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: "AllRoles", required: true },

  salaryRules: SalaryRulesSchema,

  calculatedBreakup: {
    totalAllowances: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    breakdown: [BreakupDetailSchema],  // detailed breakdown
  },

  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model("BreakupFile", BreakupFileSchema);

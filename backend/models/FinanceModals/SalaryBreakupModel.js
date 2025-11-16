// models/FinanceModals/BreakupfileModel.js
import mongoose from "mongoose";

const BreakdownSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ["base", "allowance", "deduction", "net"], required: true },
  value: { type: Number, required: true },
  calculation: { type: String, required: true },
  // NEW: mark lines that should not be summed into totalAllowances/totalDeductions
  excludeFromTotals: { type: Boolean, default: false },
}, { _id: false });

const CalculatedBreakupSchema = new mongoose.Schema({
  breakdown: { type: [BreakdownSchema], default: [] },
  totalAllowances: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },
}, { _id: false });

const ComponentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["fixed", "percentage"], required: true },
  value: { type: Number, required: true },
}, { _id: false });

const SalaryRulesSchema = new mongoose.Schema({
  baseSalary: { type: Number, required: true },
  salaryType: { type: String, enum: ["monthly", "hourly"], default: "monthly" },

  // NEW ARRAYS
  allowances: { type: [ComponentSchema], default: [] },
  deductions: { type: [ComponentSchema], default: [] },
  terminalBenefits: { type: [ComponentSchema], default: [] },
}, { _id: false });

const BreakupFileSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "FinalizedEmployee", required: true },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: "AllRoles", required: true },
  salaryRules: SalaryRulesSchema,
  calculatedBreakup: { type: CalculatedBreakupSchema, default: {} },
}, { timestamps: true });

export default mongoose.models.SalaryBreakupfiles || mongoose.model("SalaryBreakupfiles", BreakupFileSchema);

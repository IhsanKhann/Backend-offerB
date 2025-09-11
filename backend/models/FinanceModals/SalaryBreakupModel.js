// models/FinanceModals/BreakupfileModel.js
import mongoose from "mongoose";

const BreakdownSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ["base", "allowance", "deduction"], required: true },
  value: { type: Number, required: true },
  calculation: { type: String, required: true },
}, { _id: false });

const CalculatedBreakupSchema = new mongoose.Schema({
  breakdown: { type: [BreakdownSchema], default: [] },
  totalAllowances: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },
}, { _id: false });

// 🔑 Reuse same structure as AllRoles
const ComponentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ["allowance", "deduction"], required: true },
  type: { type: String, enum: ["fixed", "percentage"], required: true },
  value: { type: Number, required: true },
}, { _id: false });

const SalaryRulesSchema = new mongoose.Schema({
  baseSalary: { type: Number, required: true },
  salaryType: { type: String, enum: ["monthly", "hourly"], default: "monthly" },
  components: { type: [ComponentSchema], default: [] }, // ✅ same as AllRoles
}, { _id: false });

const BreakupFileSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "FinalizedEmployee", required: true },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: "AllRoles", required: true },
  salaryRules: SalaryRulesSchema, // ✅ identical to AllRoles
  calculatedBreakup: { type: CalculatedBreakupSchema, default: {} },
}, { timestamps: true });

export default mongoose.model("BreakupFile", BreakupFileSchema);

// models/FinanceModals/BreakupfileModel.js
import mongoose from "mongoose";

const BreakdownSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["base", "allowance"], required: true },
  value: { type: Number, required: true },
  calculation: { type: String, required: true },
}, { _id: false });

const CalculatedBreakupSchema = new mongoose.Schema({
  breakdown: { type: [BreakdownSchema], default: [] },
  totalAllowances: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },
}, { _id: false });

const BreakupFileSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "FinalizedEmployee", required: true },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: "AllRoles", required: true },
  salaryRules: {
    baseSalary: { type: Number, required: true },
    salaryType: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    allowances: [
      {
        name: String,
        type: { type: String, enum: ["fixed", "percentage"] },
        value: Number,
      }
    ],
  },
  calculatedBreakup: { type: CalculatedBreakupSchema, default: {} },
}, { timestamps: true });

export default mongoose.model("BreakupFile", BreakupFileSchema);

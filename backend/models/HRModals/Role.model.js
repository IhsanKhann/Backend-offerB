import mongoose from "mongoose";

// Component Schema for salary rules
const ComponentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["fixed", "percentage"], required: true },
  value: { type: Number, required: true },
}, { _id: false });

// Salary Rules Schema
const SalaryRulesSchema = new mongoose.Schema({
  baseSalary: { type: Number, required: true },
  salaryType: { type: String, enum: ["monthly", "hourly"], default: "monthly" },
  allowances: { type: [ComponentSchema], default: [] },
  deductions: { type: [ComponentSchema], default: [] },
  terminalBenefits: { type: [ComponentSchema], default: [] },
}, { _id: false });

// Main Role Schema (Role Declaration)
const RoleSchema = new mongoose.Schema(
  {
    // Basic role information
    roleName: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      default: "",
    },

    // Department code for notification isolation
    code: {
      type: String,
      enum: ["HR", "Finance", "BusinessOperation"],
      required: true,
    },

    // Organizational hierarchy level
    status: {
      type: String,
      enum: ["Offices", "Groups", "Divisions", "Departments", "Branches", "Cells"],
      required: true,
    },

    // Salary Rules (merged from AllRoles)
    salaryRules: {
      type: SalaryRulesSchema,
      required: true,
    },

    // Permissions
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      }
    ],

    // Metadata
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
RoleSchema.index({ roleName: 1 });
RoleSchema.index({ code: 1 });
RoleSchema.index({ status: 1 });
RoleSchema.index({ code: 1, status: 1 });

const RoleModel = mongoose.model("Role", RoleSchema);
export default RoleModel;
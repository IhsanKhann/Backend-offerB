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

// Represents GLOBAL roles independent of department/hierarchy
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

    // Role category (optional organizational grouping)
    category: {
      type: String,
      enum: ["Executive", "Management", "Staff", "Support", "Technical"],
      default: "Staff",
    },

    // Salary Rules (global defaults for this role)
    salaryRules: {
      type: SalaryRulesSchema,
      required: true,
    },

    // Permissions (global capabilities for this role)
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
RoleSchema.index({ category: 1 });
RoleSchema.index({ isActive: 1 });

const RoleModel = mongoose.model("Role", RoleSchema);
export default RoleModel;
import mongoose from "mongoose";
import AllRolesModel from "../../models/HRModals/AllRoles.model.js";
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";
import BreakupFile from "../../models/FinanceModals/SalaryBreakupModel.js";
import BreakupRulesModel from "../../models/FinanceModals/BreakupRules.js";

export const getSalaryRulesByRoleName = async (req, res) => {
  try {
    const roleNameDecoded = decodeURIComponent(req.params.roleName).trim();
    const role = await AllRolesModel.findOne({
      name: { $regex: new RegExp(`^${roleNameDecoded}$`, "i") },
    });

    if (!role)
      return res.status(404).json({
        success: false,
        message: `Role '${roleNameDecoded}' not found`,
      });

    return res.status(200).json({
      success: true,
      data: role, // send the whole role object
    });
  } catch (err) {
    console.error("Error fetching salary rules:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getSingleSalaryRole = async (req, res) => {
  try {
    const roleNameDecoded = decodeURIComponent(req.params.roleName).trim();
    const role = await AllRolesModel.findOne({
      name: { $regex: new RegExp(`^${roleNameDecoded}$`, "i") },
    });

    if (!role)
      return res.status(404).json({ success: false, message: "Role not found" });

    return res.status(200).json({ success: true, data: role.salaryRules || null });
  } catch (err) {
    console.error("Error fetching salary rules:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getBreakupFile = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const breakup = await BreakupFile.findOne({ employeeId })
      .populate("employeeId", "individualName personalEmail")
      .populate("roleId", "name");

    if (!breakup)
      return res.status(404).json({ success: false, message: "Breakup file not found" });

    return res.status(200).json({ success: true, data: breakup });
  } catch (err) {
    console.error("Error fetching breakup file:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

const safeToObjectId = (id) => {
  if (!id) return null;
  const idStr = String(id);
  return mongoose.Types.ObjectId.isValid(idStr) ? new mongoose.Types.ObjectId(idStr) : null;
};

export const createBreakupFile = async (req, res) => {
  try {
    const { employeeId, roleId, salaryRules } = req.body;

    // 1️⃣ Validate Employee
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // 2️⃣ Validate Role
    const role = await AllRolesModel.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // 3️⃣ Extract salary rules
    const { baseSalary = 0, components = [] } = salaryRules;

    // 4️⃣ Start breakdown with base salary
    let breakdown = [
      {
        name: "Base Salary",
        category: "base",
        value: baseSalary,
        calculation: `Fixed base salary = ${baseSalary}`,
      },
    ];

    let totalAllowances = 0;
    let totalDeductions = 0;

    // 5️⃣ Process components
    for (const component of components) {
      let calculatedValue = 0;

      if (component.type === "percentage") {
        calculatedValue = (baseSalary * (component.value || 0)) / 100;

        // Special case: Administrative Allowance = 100% of base salary
        if (component.name === "Administrative Allowance") {
          calculatedValue = baseSalary;
        }
      } else {
        calculatedValue = component.value || 0;
      }

      breakdown.push({
        name: component.name,
        category: component.category, // allowance | deduction
        value: calculatedValue,
        calculation:
          component.type === "percentage"
            ? `${component.value}% of base = ${calculatedValue}`
            : `Fixed = ${calculatedValue}`,
      });

      if (component.category === "deduction") {
        totalDeductions += calculatedValue;
      } else if (component.category === "allowance") {
        totalAllowances += calculatedValue;
      }
    }

    // 6️⃣ Calculate Net Salary directly
    const netSalary = baseSalary + totalAllowances - totalDeductions;

    // 7️⃣ Save or update Breakup File
    const breakupFile = await BreakupFile.findOneAndUpdate(
      { employeeId },
      {
        employeeId,
        roleId,
        salaryRules: {
          baseSalary,
          salaryType: salaryRules.salaryType || "monthly",
          components,
        },
        calculatedBreakup: {
          breakdown,
          totalAllowances,
          totalDeductions,
          netSalary, // ✅ direct net salary
        },
      },
      { new: true, upsert: true }
    );

    return res.status(201).json({
      success: true,
      message: "✅ Breakup file created/updated successfully",
      data: breakupFile,
    });
  } catch (err) {
    console.error("❌ Error creating breakup file:", err);
    return res.status(500).json({
      success: false,
      message: "Error creating breakup file",
      error: err.message,
    });
  }
};


// ------------------ Create Breakup Rule ------------------
export const createBreakupRule = async (req, res) => {
  try {
    const { transactionType, incrementType, splits } = req.body;

    if (!transactionType || !splits || splits.length === 0) {
      return res.status(400).json({ error: "transactionType and at least one split are required" });
    }

    // Transform splits to ensure ObjectIds are properly cast
    const formattedSplits = splits.map((split) => ({
      componentName: split.componentName,
      type: split.type,
      instanceId: safeToObjectId(split.instanceId),
      summaryId: safeToObjectId(split.summaryId),
      definitionId: safeToObjectId(split.definitionId),
      debitOrCredit: split.debitOrCredit,
      percentage: split.percentage || 0,
      fixedAmount: split.fixedAmount || 0,
      value: split.value || 0,
      fieldLineId: split.fieldLineId || null,
      mirrors: (split.mirrors || []).map((mirror) => ({
        instanceId: safeToObjectId(mirror.instanceId),
        summaryId: safeToObjectId(mirror.summaryId),
        definitionId: safeToObjectId(mirror.definitionId),
        debitOrCredit: mirror.debitOrCredit,
        fallback: mirror.fallback || "none",
        fieldLineId: mirror.fieldLineId || null,
      })),
    }));

    const newRule = new BreakupRulesModel({
      transactionType,
      incrementType: incrementType || "both",
      splits: formattedSplits,
    });

    await newRule.save();

    return res.status(201).json({
      message: "✅ Breakup rule created successfully",
      rule: newRule,
    });
  } catch (err) {
    console.error("createBreakupRule Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};

// ------------------ Get All Breakup Rules ------------------
export const getBreakupRules = async (req, res) => {
  try {
    const rules = await BreakupRulesModel.find().lean();
    return res.status(200).json(rules);
  } catch (err) {
    console.error("getBreakupRules Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
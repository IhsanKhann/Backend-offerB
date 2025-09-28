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

    if (!employeeId || !roleId || !salaryRules) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // ✅ Convert to ObjectId
    const empObjectId = new mongoose.Types.ObjectId(employeeId);
    const roleObjectId = new mongoose.Types.ObjectId(roleId);

    // 1️⃣ Validate Employee
    const employee = await FinalizedEmployeeModel.findById(empObjectId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // 2️⃣ Validate Role
    const role = await AllRolesModel.findById(roleObjectId);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // 3️⃣ Extract salary rules
    const { baseSalary = 0, components = [] } = salaryRules || {};

    // 4️⃣ Start breakdown with base salary
    const breakdown = [
      {
        name: "Base Salary",
        category: "base",
        value: Number(baseSalary) || 0,
        calculation: `Fixed base salary = ${Number(baseSalary) || 0}`,
        excludeFromTotals: false,
      },
    ];

    let totalAllowances = 0;
    let totalDeductions = 0;

    // 5️⃣ Process components
    for (const component of components) {
      const compType = component.type;
      const compCategory = component.category; // "allowance" | "deduction"
      const compName = component.name?.trim();

      let calculatedValue = 0;

      if (compType === "percentage") {
        const pct = Number(component.value || 0);
        calculatedValue = Math.round((Number(baseSalary || 0) * pct) / 100);

        if (compName && compName.toLowerCase() === "administrative allowance") {
          calculatedValue = Number(baseSalary || 0);
        }
      } else {
        calculatedValue = Number(component.value || 0);
      }

      const excludeFromTotals =
        compName && compName.toLowerCase() === "administrative allowance";

      breakdown.push({
        name: compName || "Component",
        category: compCategory,
        value: calculatedValue,
        calculation:
          compType === "percentage"
            ? `${component.value}% of base = ${calculatedValue}`
            : `Fixed = ${calculatedValue}`,
        excludeFromTotals,
      });

      if (compCategory === "deduction") totalDeductions += calculatedValue;
      else if (compCategory === "allowance" && !excludeFromTotals) totalAllowances += calculatedValue;
    }

    // 6️⃣ Calculate Net Salary
    const netSalary = Math.round((Number(baseSalary || 0) + totalAllowances - totalDeductions) * 100) / 100;

    breakdown.push({
      name: "Net Salary",
      category: "net",
      value: netSalary,
      calculation: `(${baseSalary} + ${totalAllowances}) - ${totalDeductions} = ${netSalary}`,
      excludeFromTotals: false,
    });

    // 7️⃣ Save/Update Breakup File (using $set and upsert)
    const breakupFile = await BreakupFile.findOneAndUpdate(
      { employeeId: empObjectId }, // filter
      {
        $set: {
          roleId: roleObjectId,
          salaryRules: {
            baseSalary: Number(baseSalary || 0),
            salaryType: salaryRules.salaryType || "monthly",
            components: components || [],
          },
          calculatedBreakup: {
            breakdown,
            totalAllowances,
            totalDeductions,
            netSalary,
          },
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
      return res.status(400).json({
        error: "transactionType and at least one split are required",
      });
    }

    // 🔑 Rules are only mapping — no percentages or fixed values
    const formattedSplits = splits.map((split) => ({
      componentName: split.componentName, // e.g. "Net Salary"
      type: split.type, // allowance / deduction / net / base
      instanceId: safeToObjectId(split.instanceId),
      summaryId: safeToObjectId(split.summaryId),
      definitionId: safeToObjectId(split.definitionId),
      debitOrCredit: split.debitOrCredit, // explicit debit/credit
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
    return res
      .status(500)
      .json({ error: err.message || "Internal server error" });
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
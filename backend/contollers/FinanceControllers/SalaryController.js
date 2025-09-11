import mongoose from "mongoose";
import AllRolesModel from "../../models/HRModals/AllRoles.model.js";
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";
import BreakupFile from "../../models/FinanceModals/SalaryBreakupModel.js";

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

export const createBreakupFile = async (req, res) => {
  try {
    const { employeeId, roleId, salaryRules } = req.body;

    // 1️⃣ Validate Employee
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // 2️⃣ Validate Role
    const role = await AllRolesModel.findById(roleId);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // 3️⃣ Extract rules
    const { baseSalary = 0, allowances = [], deductions = [] } = salaryRules;

    // 🔄 Normalize into a single `components` array
    const components = [
      ...allowances.map(a => ({ ...a, category: "allowance" })),
      ...deductions.map(d => ({ ...d, category: "deduction" })),
    ];

    // 4️⃣ Build Breakdown
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

    for (const component of components) {
      let calculatedValue = 0;

      if (component.type === "percentage") {
        calculatedValue = (baseSalary * component.value) / 100;

        // Special case
        if (component.name === "Administrative Allowance") {
          calculatedValue = baseSalary;
        }
      } else {
        calculatedValue = component.value;
      }

      breakdown.push({
        name: component.name,
        category: component.category,
        value: calculatedValue,
        calculation:
          component.type === "percentage"
            ? `${component.value}% of base = ${calculatedValue}`
            : `Fixed = ${calculatedValue}`,
      });

      if (component.category === "deduction") {
        totalDeductions += calculatedValue;
      } else {
        totalAllowances += calculatedValue;
      }
    }

    // 5️⃣ Calculate Net Salary
    const netSalary = baseSalary + totalAllowances - totalDeductions;

    // 6️⃣ Create/Update BreakupFile
    const breakupFile = await BreakupFile.findOneAndUpdate(
      { employeeId },
      {
        employeeId,
        roleId,
        salaryRules: {
          baseSalary,
          salaryType: salaryRules.salaryType || "monthly",
          allowances,
          deductions,
        },
        calculatedBreakup: {
          breakdown,
          totalAllowances,
          totalDeductions,
          netSalary,
        },
      },
      { new: true, upsert: true } // ✅ update if exists, create if not
    );

    return res.status(201).json({
      success: true,
      message: "Breakup file created/updated successfully",
      data: breakupFile,
    });
  } catch (err) {
    console.error("Error creating breakup file:", err);
    return res.status(500).json({
      success: false,
      message: "Error creating breakup file",
      error: err.message,
    });
  }
};

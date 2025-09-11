import mongoose from "mongoose";
import AllRolesModel from "../../models/HRModals/AllRoles.model.js";
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";
import BreakupFile from "../../models/FinanceModals/BreakupfileModel.js";

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
    const { employeeId, roleId, salaryRules, breakup } = req.body;

    // ---------- VALIDATION ----------
    if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: "Invalid or missing employeeId" });
    }

    if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({ message: "Invalid or missing roleId" });
    }

    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const role = await AllRolesModel.findById(roleId);
    if (!role) return res.status(404).json({ message: "Role not found" });

    if (!salaryRules || typeof salaryRules.baseSalary !== "number") {
      return res.status(400).json({ message: "Invalid salaryRules" });
    }

    if (!Array.isArray(breakup) || breakup.length === 0) {
      return res.status(400).json({ message: "Breakup must be a non-empty array" });
    }

    // ---------- VALIDATE EACH BREAKUP ITEM ----------
    const validatedBreakup = breakup.map(item => {
      if (
        !item.name ||
        !item.type ||
        !["base", "allowance"].includes(item.type) ||
        typeof item.value !== "number" ||
        !item.calculation
      ) {
        throw new Error(`Invalid breakup item: ${JSON.stringify(item)}`);
      }

      return {
        name: String(item.name),
        type: item.type,
        value: Number(item.value),
        calculation: String(item.calculation),
      };
    });

    // ---------- CALCULATE TOTAL ALLOWANCES AND NET SALARY ----------
    const totalAllowances = validatedBreakup
      .filter(item => item.type === "allowance")
      .reduce((sum, item) => sum + item.value, 0);

    const baseSalaryItem = validatedBreakup.find(item => item.type === "base");
    const baseSalary = baseSalaryItem ? baseSalaryItem.value : salaryRules.baseSalary;

    const netSalary = baseSalary + totalAllowances;

    const calculatedBreakup = {
      breakdown: validatedBreakup,
      totalAllowances,
      netSalary,
    };

    // ---------- CREATE OR UPDATE BREAKUP FILE ----------
    let breakupFile = await BreakupFile.findOne({ employeeId });
    if (breakupFile) {
      breakupFile.salaryRules = salaryRules;
      breakupFile.calculatedBreakup = calculatedBreakup;
      breakupFile.roleId = roleId;
      await breakupFile.save();
    } else {
      breakupFile = await BreakupFile.create({
        employeeId,
        roleId,
        salaryRules,
        calculatedBreakup,
      });
    }

    return res.status(200).json({ message: "Breakup file created/updated successfully", breakupFile });

  } catch (error) {
    console.error("Error creating breakup file:", error);
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
};
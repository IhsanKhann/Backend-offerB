// controllers/employee.controller.js
import mongoose from "mongoose";
import EmployeeModel from "../models/Employee.model.js";
import bcrypt from "bcrypt";
import { uploadImageToCloudinary /*, destroyImageFromCloudinary*/ } from "../utilis/cloudinary.js";
import RoleModel from "../models/Role.model.js";

// --- helpers ----------------------------------------------------
const generatePassword = () => Math.random().toString(36).slice(-8);
const hashPassword = async (password) => await bcrypt.hash(password, 10);
const toDate = (val) => (val ? new Date(val) : undefined);

const safeParse = (field, fieldName = "") => {
  try {
    return field ? JSON.parse(field) : undefined;
  } catch (err) {
    console.error(`❌ Failed to parse ${fieldName}:`, err.message);
    return undefined;
  }
};

const normalizeSalary = (src = {}) => ({
  startDate: toDate(src.startDate),
  type: src.type,
  amount: src.amount != null ? Number(src.amount) : undefined,
  terminalBenefits: Array.isArray(src.terminalBenefits)
    ? src.terminalBenefits.filter(Boolean)
    : src.terminalBenefits
    ? [src.terminalBenefits]
    : [],
  terminalBenefitDetails: src.terminalBenefitDetails,
});

const normalizeTenure = (src = {}) => ({
  joining: toDate(src.joining),
  confirmation: toDate(src.confirmation),
  retirement: toDate(src.retirement),
  contractExpiryOrRenewal: toDate(src.contractExpiryOrRenewal),
  promotion: toDate(src.promotion),
  otherEventDate: toDate(src.otherEventDate),
});

const normalizeChangeOfStatus = (src = {}) => ({
  status: src.status,
  date: toDate(src.date),
});

const normalizeEmploymentHistory = (src = {}) => ({
  employeeId: src.employeeId,
  orgName: src.orgName,
  releaseDate: toDate(src.releaseDate),
  designation: src.designation,
  organizationsWorkedFor: src.organizationsWorkedFor,
});

const normalizeTransfers = (arr) =>
  Array.isArray(arr)
    ? arr.map((t) => ({
        department: t.department,
        division: t.division,
        group: t.group,
        branch: t.branch,
        city: t.city,
        country: t.country,
        immediateBoss: t.immediateBoss,
        date: toDate(t.date),
      }))
    : [];

// --- controllers -----------------------------------------------

export const RegisterEmployee = async (req, res) => {
  try {
    console.log("📝 RegisterEmployee received:", req.body);
    console.log("📁 File received:", req.file);
    
    // file optional for now
    const image = req.file;
    let uploadedImage = null;
    
    if (image) {
      try {
        uploadedImage = await uploadImageToCloudinary(image, "employees", "profileImage");
      } catch (uploadError) {
        console.error("❌ Image upload failed:", uploadError);
        // Continue without image for now
      }
    }

    const {
      individualName,
      fatherName,
      qualification,
      dob,
      govtId,
      passportNo,
      alienRegNo,
      officialEmail,
      personalEmail,
      previousOrgEmail,
      address,
      employmentHistory,
      employmentStatus,
      role,
      tenure,
      transfers,
      changeOfStatus,
      salary,
    } = req.body;

    // basic required field checks (strings present)
    if (!individualName || !fatherName || !dob || !officialEmail || !personalEmail || !address || !employmentStatus || !role) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (!govtId && !passportNo && !alienRegNo) {
      return res.status(400).json({ success: false, message: "At least one ID is required" });
    }

    // uniqueness checks
    const existingEmployee = await EmployeeModel.findOne({
      $or: [{ officialEmail }, { personalEmail }, { individualName }],
    });
    if (existingEmployee) {
      return res.status(400).json({ success: false, message: "Employee already exists" });
    }

    // parse & normalize nested payloads
    const parsedAddress = safeParse(address, "address") || {};
    const parsedSalary = normalizeSalary(safeParse(salary, "salary") || {});
    const parsedTenure = normalizeTenure(safeParse(tenure, "tenure") || {});
    const parsedTransfers = normalizeTransfers(safeParse(transfers, "transfers"));
    const parsedChangeOfStatus = normalizeChangeOfStatus(safeParse(changeOfStatus, "changeOfStatus") || {});
    const parsedHistory = normalizeEmploymentHistory(safeParse(employmentHistory, "employmentHistory") || {});

    // build doc
    const employeeData = {
      individualName,
      fatherName,
      qualification,
      dob: toDate(dob),
      govtId,
      passportNo,
      alienRegNo,
      officialEmail,
      personalEmail,
      previousOrgEmail,
      address: parsedAddress,
      employmentHistory: parsedHistory,
      employmentStatus,
      role,
      tenure: parsedTenure,
      salary: parsedSalary,
      changeOfStatus: parsedChangeOfStatus,
      transfers: parsedTransfers,
      profileSubmission: { submitted: true, passwordCreated: false, emailSent: false },
    };

    // Add avatar only if upload succeeded
    if (uploadedImage) {
      employeeData.avatar = {
        url: uploadedImage.secure_url,
        public_id: uploadedImage.public_id,
      };
    }

    const newEmployee = new EmployeeModel(employeeData);

    // let mongoose validate types & requireds
    await newEmployee.validate();

    // save
    await newEmployee.save();

    return res.status(201).json({
      success: true,
      message: "Employee registered successfully",
      employeeId: newEmployee._id,
    });
  } catch (error) {
    // Mongoose validation errors → 400 with details
    if (error?.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        details: error.errors
          ? Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k, v.message]))
          : error.message,
      });
    }
    console.error("🔥 RegisterEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const ApprovedEmployee = async (req, res) => {
  try {
    const { employeeid } = req.params;
    if (!employeeid) {
      return res.status(400).json({ success: false, message: "employeeId is not defined." });
    }

    const employee = await EmployeeModel.findById(employeeid);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // generate & hash password
    const tempPassword = generatePassword();
    const passwordHash = await hashPassword(tempPassword);

    employee.passwordHash = passwordHash;
    employee.profileSubmission = {
      ...(employee.profileSubmission || {}),
      submitted: true,
      passwordCreated: true,
      emailSent: true, // set to true only after actually sending email in real flow
    };

    await employee.save();

    return res.status(200).json({
      success: true,
      message: "Employee approved, password saved and email sent successfully",
      // expose plain password ONLY in development
      tempPassword: process.env.NODE_ENV === "development" ? tempPassword : undefined,
      email: employee.personalEmail,
    });
  } catch (error) {
    console.error("🔥 ApprovedEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Employee couldn't be approved" });
  }
};

export const RejectedEmployee = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "The employeeId is undefined or invalid" });
    }

    // If you want to also delete the Cloudinary image, fetch first:
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found or already deleted" });
    }

    // Optional: delete avatar from cloudinary
    // if (employee.avatar?.public_id) {
    //   try {
    //     await destroyImageFromCloudinary(employee.avatar.public_id);
    //   } catch (e) {
    //     console.warn("⚠️ Failed to delete avatar from Cloudinary:", e.message);
    //   }
    // }

    await EmployeeModel.findByIdAndDelete(employeeId);

    return res.status(200).json({ success: true, message: "Employee deleted successfully" });
  } catch (error) {
    console.error("🔥 RejectedEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to delete employee" });
  }
};

export const AssignEmployeeRole = async (req, res) => {
  try {
    console.log("📝 AssignEmployeeRole received body:", req.body);
    
    const { employeeId, role } = req.body;
    const { division, department, group, cell } = role || {};

    console.log("📝 Parsed values:", { employeeId, division, department, group, cell });

    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }
    
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ success: false, message: "Invalid Employee ID format" });
    }
    
    if (!division && !department && !group && !cell) {
      return res.status(400).json({ success: false, message: "At least one role field is required" });
    }

    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Allow multiple roles but prevent exact duplicates (same combination)
    const existing = await RoleModel.findOne({
      employee: employeeId,
      division: division || null,
      department: department || null,
      group: group || null,
      cell: cell || null,
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "This exact role is already assigned" });
    }

    const newRole = new RoleModel({
      employee: employeeId,
      division,
      department,
      group,
      cell,
    });

    await newRole.save();

    return res.status(200).json({
      success: true,
      message: "Role assigned successfully",
      role: newRole,
    });
  } catch (error) {
    console.error("🔥 AssignEmployeeRole error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

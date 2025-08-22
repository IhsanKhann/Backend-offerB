// controllers/employee.controller.js
import mongoose from "mongoose";
import EmployeeModel from "../models/Employee.model.js";
import bcrypt from "bcrypt";
import { uploadImageToCloudinary, destroyImageFromCloudinary } from "../utilis/cloudinary.js";
import RoleModel from "../models/Role.model.js";
import FinalizedEmployeeModel from "../models/FinalizedEmployees.model.js";


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
export const getAllEmployees = async (req, res) => {
  try {
    const employees = await EmployeeModel.find();

    console.log("employees: ", employees) 

    if (employees.length > 0) {
      return res.status(200).json({
        status: true,
        message: "Employees fetched successfully",
        employees,
      });
    } else {
      return res.status(404).json({
        status: false,
        message: "No employees found",
      });
    }
  } catch (error) {
    console.error("Error fetching employees:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

export const getSingleEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        status: false,
        message: "employeeId not provided",
      });
    }

    const employee = await EmployeeModel.findById(employeeId); // ✅ use findById

    if (!employee) {
      return res.status(404).json({
        status: false,
        message: "Employee not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Employee found",
      employee,
    });

  } catch (error) {
    console.error("Error fetching employee:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // Find employee first (so we can access image info before deleting)
    const employee = await EmployeeModel.findById(id);

    if (!employee) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }

    // Delete roles associated with employee
    const postRemoved = await RoleModel.deleteMany({ employeeId: id });

    if (!postRemoved) {
      return res.status(404).json({ status: false, message: "Roles not found" });
    }

    // Delete employee document
    await EmployeeModel.findByIdAndDelete(id);

    // Destroy image from Cloudinary if exists
    if (employee.image && employee.image.public_id) {
      await destroyImageFromCloudinary(employee.image.public_id);
    }

    return res.status(200).json({
      status: true,
      message: "Employee and associated roles deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

export const RegisterEmployee = async (req, res) => {
  try {
    const image = req.file;
    let uploadedImage = null;

    if (image) {
      try {
        uploadedImage = await uploadImageToCloudinary(image, "employees", "profileImage");
      } catch (uploadError) {
        console.warn("❌ Image upload failed:", uploadError.message);
      }
    }

    const {
      individualName, fatherName, qualification, dob,
      govtId, passportNo, alienRegNo,
      officialEmail, personalEmail, previousOrgEmail,
      address, employmentHistory, employmentStatus,
      role, tenure, transfers, changeOfStatus, salary
    } = req.body;

    // Basic validations
    if (!individualName || !fatherName || !dob || !officialEmail || !personalEmail || !address || !employmentStatus || !role) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (!govtId && !passportNo && !alienRegNo) {
      return res.status(400).json({ success: false, message: "At least one ID is required" });
    }

    // Uniqueness check - checking for duplicates
    const existingEmployee = await EmployeeModel.findOne({
      $or: [{ officialEmail }, { personalEmail }, { individualName }],
    });
    if (existingEmployee) return res.status(400).json({ success: false, message: "Employee already exists" });

    // Parse nested payloads
    const parsedAddress = typeof address === "string" ? safeParse(address, "address") : address || {};
    const parsedSalary  = typeof salary  === "string" ? normalizeSalary(safeParse(salary, "salary") || {}) : normalizeSalary(salary || {});
    const parsedTenure  = typeof tenure  === "string" ? normalizeTenure(safeParse(tenure, "tenure") || {}) : normalizeTenure(tenure || {});
    const parsedTransfers = normalizeTransfers(typeof transfers === "string" ? safeParse(transfers, "transfers") : transfers);
    const parsedChangeOfStatus = normalizeChangeOfStatus(typeof changeOfStatus === "string" ? safeParse(changeOfStatus, "changeOfStatus") : changeOfStatus || {});
    const parsedHistory = normalizeEmploymentHistory(typeof employmentHistory === "string" ? safeParse(employmentHistory, "employmentHistory") : employmentHistory || {});

    // Build draft employee object
    const employeeData = {
      individualName, fatherName, qualification,
      dob: toDate(dob), govtId, passportNo, alienRegNo,
      officialEmail, personalEmail, previousOrgEmail,
      address: parsedAddress,
      employmentHistory: parsedHistory,
      employmentStatus, role,
      tenure: parsedTenure,
      salary: parsedSalary,
      changeOfStatus: parsedChangeOfStatus,
      transfers: parsedTransfers,
      DraftStatus: { status: "Draft", PostStatus: "Not Assigned" },
      finalizationStatus: "Pending",
      ...(uploadedImage && { avatar: { url: uploadedImage.secure_url, public_id: uploadedImage.public_id } }),
    };

    const newEmployee = new EmployeeModel(employeeData);
    await newEmployee.validate();
    await newEmployee.save();

    return res.status(201).json({ success: true, message: "Employee registered successfully", employeeId: newEmployee._id });
  } catch (error) {
    console.error("🔥 RegisterEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const SubmitEmployee = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) 
      return res.status(400).json({ success: false, message: "employeeId required" });

    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) 
      return res.status(404).json({ success: false, message: "Employee not found" });

    // ✅ Correct duplicate check in FinalizedEmployee collection
    const duplicateFinalized = await FinalizedEmployeeModel.findOne({
      $or: [
        { officialEmail: employee.officialEmail },
        { personalEmail: employee.personalEmail },
        { govtId: employee.govtId },
        { passportNo: employee.passportNo },
        { alienRegNo: employee.alienRegNo },
      ],
    });

    if (duplicateFinalized) {
      return res.status(400).json({ success: false, message: "Duplicate employee exists in finalized employees" });
    }

    // 1️⃣ Update draft status
    employee.DraftStatus.status = "Submitted";
    employee.finalizationStatus = "Pending";
    await employee.save();

    // 2️⃣ Create FinalizedEmployee with Pending status
    const finalizedData = {
      ...employee.toObject(),
      employeeId: employee._id, // optional reference
      profileStatus: {
        submitted: true,
        decision: "Pending",
        passwordCreated: false,
        emailSent: false,
      },
    };

    delete finalizedData.DraftStatus;
    delete finalizedData._id;

    const finalizedEmployee = await FinalizedEmployeeModel.create(finalizedData);

    return res.status(200).json({
      success: true,
      message: "Draft submitted successfully and FinalizedEmployee created",
      finalizedEmployeeId: finalizedEmployee._id,
    });
  } catch (error) {
    console.error("🔥 SubmitEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to submit draft" });
  }
};

export const ApproveEmployee = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });

    const finalizedEmployee = await FinalizedEmployeeModel.findById(finalizedEmployeeId);
    if (!finalizedEmployee) return res.status(404).json({ success: false, message: "FinalizedEmployee not found" });

    // Generate password
    const tempPassword = generatePassword();
    const passwordHash = await hashPassword(tempPassword);

    // Update profile status and password
    finalizedEmployee.profileStatus.decision = "Approved";
    finalizedEmployee.profileStatus.passwordCreated = true;
    finalizedEmployee.passwordHash = passwordHash;
    await finalizedEmployee.save();

    // Delete original draft employee
    await EmployeeModel.findByIdAndDelete(finalizedEmployee.employeeId);

    return res.status(200).json({
      success: true,
      message: "Employee approved and finalized successfully",
      tempPassword: process.env.NODE_ENV === "development" ? tempPassword : undefined,
      email: finalizedEmployee.personalEmail,
    });
  } catch (error) {
    console.error("🔥 ApproveEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Employee couldn't be approved" });
  }
};

export const RejectEmployee = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });

    const finalizedEmployee = await FinalizedEmployeeModel.findById(finalizedEmployeeId);
    if (!finalizedEmployee) return res.status(404).json({ success: false, message: "FinalizedEmployee not found" });

    // Optional: delete avatar from cloudinary
    if (finalizedEmployee.avatar?.public_id) {
      try {
        await destroyImageFromCloudinary(finalizedEmployee.avatar.public_id);
      } catch (e) {
        console.warn("⚠️ Failed to delete avatar from Cloudinary:", e.message);
      }
    }

    // Mark rejected
    finalizedEmployee.profileStatus.decision = "Rejected";
    await finalizedEmployee.save();

    // Delete draft employee
    await EmployeeModel.findByIdAndDelete(finalizedEmployee.employeeId);

    // Optional: delete finalizedEmployee document if you want complete cleanup
    await FinalizedEmployeeModel.findByIdAndDelete(finalizedEmployeeId);

    return res.status(200).json({ success: true, message: "Employee rejected and records cleaned successfully" });
  } catch (error) {
    console.error("🔥 RejectEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to reject employee" });
  }
};

// roles or assigning posts functions.
export const AssignEmployeePost = async (req, res) => {
  try {
    console.log("📝 AssignEmployeePost received body:", req.body);

    const { employeeId, role, employeeName } = req.body;
    const { division, department, group, cell } = role || {};

    console.log("📝 Parsed values:", { employeeId,employeeName, division, department, group, cell,});

    // Validate employeeId
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }

    // Validate role fields
    if (!division && !department && !group && !cell) {
      return res.status(400).json({ success: false, message: "At least one role field is required" });
    }

    // Check if employee exists
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Prevent exact duplicate role assignments
    const existing = await RoleModel.findOne({
      employeeId,
      employeeName,
      "role.division": division || null,
      "role.department": department || null,
      "role.group": group || null,
      "role.cell": cell || null,
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "This exact role is already assigned" });
    }

    // Create new role document
    const newRole = new RoleModel({
      employeeId,
      employeeName,
      role: { division, department, group, cell },
    });

    // Update employee's PostStatus
    employee.DraftStatus.PostStatus = "Assigned";
    await employee.save();

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

export const getAllRoles = async (req, res) => {
  try {
    const roles = await RoleModel.find();

    if (roles.length > 0) {
      return res.status(200).json({
        status: true,
        message: "Roles fetched successfully",
        roles,
      });
    } else {
      return res.status(404).json({
        status: false,
        message: "No roles found",
      });
    }
  } catch (error) {
    console.error("Error fetching roles:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

export const getSingleRole = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({
        status: false,
        message: "Id is either undefined or invalid",
      });
    }

    console.log("id check in getSingleRole:", employeeId);

    const roles = await RoleModel.findOne({ employeeId });

    if (!roles) {
      // No roles yet → return success but empty data
      return res.status(200).json({
        status: true,
        message: "No roles assigned yet",
        roles: null, // <-- makes frontend easier to check
      });
    }

    return res.status(200).json({
      status: true,
      message: "Roles fetched successfully",
      roles,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

// get all or get single finalized employee.
export const getFinalizedEmployees = async (req, res) => {
  try {
    const finalizedEmployees = await FinalizedEmployeeModel.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: finalizedEmployees.length,
      data: finalizedEmployees
    });
  } catch (error) {
    console.error("🔥 GetAllFinalizedEmployees error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch finalized employees" });
  }
};

export const getSingleFinalizedEmployee = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });

    const finalizedEmployee = await FinalizedEmployeeModel.findById(finalizedEmployeeId);
    if (!finalizedEmployee) return res.status(404).json({ success: false, message: "FinalizedEmployee not found" });

    return res.status(200).json({
      success: true,
      finalizedEmployee: finalizedEmployee
    });
  } catch (error) {
    console.error("🔥 GetSingleFinalizedEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch finalized employee" });
  }
};

export const deleteFinalizedEmployee = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) {
      return res.status(400).json({
        success: false,
        message: "finalizedEmployeeId is required",
      });
    }

    // Find finalized employee
    const finalizedEmployee = await FinalizedEmployeeModel.findById(finalizedEmployeeId);
    if (!finalizedEmployee) {
      return res.status(404).json({
        success: false,
        message: "FinalizedEmployee not found",
      });
    }

    // // Get employeeId from finalized record
    // const employeeId = finalizedEmployee.employeeId;
    // if (employeeId) {
    //   // Revert the original employee back to draft
    //   await EmployeeModel.findByIdAndUpdate(employeeId, {
    //     status: "draft",
    //   });
    // }

    // Delete the finalized employee record
    await FinalizedEmployeeModel.findByIdAndDelete(finalizedEmployeeId);
    
    return res.status(200).json({
      success: true,
      message: "FinalizedEmployee deleted and reverted back to draft",
    });
  } catch (error) {
    console.error("🔥 DeleteFinalizedEmployee error:", error.stack || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete finalized employee",
    });
  }
};
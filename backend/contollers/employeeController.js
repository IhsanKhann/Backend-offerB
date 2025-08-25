// controllers/employee.controller.js
import mongoose from "mongoose";
import EmployeeModel from "../models/Employee.model.js";
import bcrypt from "bcrypt";
import { uploadFileToCloudinary, destroyImageFromCloudinary } from "../utilis/cloudinary.js";
import RoleModel from "../models/Role.model.js";
import FinalizedEmployeeModel from "../models/FinalizedEmployees.model.js";
import {OrgUnitModel} from "../models/OrgUnit.js";
import { PermissionModel } from "../models/Permissions.model.js";
import CounterModel from "../models/Counter.model.js";

// --- helpers ----------------------------------------------------

export const getNextUserId = async () => {
  const counter = await CounterModel.findOneAndUpdate(
    { name: "employee" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return counter.seq;
};

const generatePassword = () => Math.random().toString(36).slice(-8);
const hashPassword = async (password) => await bcrypt.hash(password, 10);
const toDate = (val) => (val ? new Date(val) : undefined);

const generateOrganizationId = (finalizedEmployee, UserId) => {
  const userName = finalizedEmployee.individualName;

  const organizationId = userName + UserId;
  return organizationId;
};

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


// --------------------------- controllers -------------------------
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
    const { employeeId } = req.params;
    if (!employeeId) return res.status(400).json({ success: false, message: "employeeId is required" });

    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    // ---------------- Delete avatar from Cloudinary ----------------
    if (employee.avatar?.public_id) {
      try {
        await destroyImageFromCloudinary(employee.avatar.public_id);
      } catch (err) {
        console.warn("Failed to delete Cloudinary image:", err.message);
      }
    }

    // ---------------- Find and delete Role ----------------
    const role = await RoleModel.findOne({ UserId: employee._id });
    if (role) {
      // Delete all permissions referenced by this role
      if (role.permissions && role.permissions.length > 0) {
        await PermissionModel.deleteMany({ _id: { $in: role.permissions } });
      }

      // Delete the role itself
      await RoleModel.findByIdAndDelete(role._id);

      // Remove OrgUnit reference inside Role (optional, since role is deleted)
      if (role.orgUnit) {
        await OrgUnitModel.findByIdAndUpdate(role.orgUnit, { $unset: { role: "" } });
      }
    }

    // ---------------- Remove OrgUnit reference from employee ----------------
    if (employee.OrgUnit) {
      await EmployeeModel.findByIdAndUpdate(employee._id, { $unset: { OrgUnit: "" } });
    }

    // ---------------- Delete Employee ----------------
    await EmployeeModel.findByIdAndDelete(employee._id);

    res.status(200).json({
      success: true,
      message: "Employee, role, permissions, OrgUnit references, and avatar deleted successfully",
    });

  } catch (error) {
    console.error("Delete Employee Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

export const RegisterEmployee = async (req, res) => {
  try {
    console.log("Incoming employee registratiosn request");
    console.log("req.body:", req.body);
    console.log("req.file:", req.file);

    const image = req.file;
    // const salaryAttachment = req.files?.salaryAttachment?.[0];

    let uploadedImage = null;
    // let uploadedSalaryAttachment = null;

    if (image) {
      try {
        console.log("⬆️ Uploading profile image to Cloudinary...");
        uploadedImage = await uploadFileToCloudinary(
          image,
          "employees/profileImage"
        );
        console.log("✅ Image uploaded:", uploadedImage);
      } catch (uploadError) {
        console.warn("❌ Image upload failed:", uploadError.message);
      }
    }

    // ================= Extract fields =================
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
      tenure,
      transfers,
      changeOfStatus,
      salary,
    } = req.body;

    console.log("📌 Parsed fields:", {
      individualName,
      fatherName,
      dob,
      govtId,
      passportNo,
      alienRegNo,
      officialEmail,
      personalEmail,
      employmentStatus,
    });

    // ================= Fix Required Fields Validation =================
    if (
      !individualName ||
      !fatherName ||
      !dob ||
      !officialEmail ||
      !personalEmail ||
      !employmentStatus
    ) {
      console.warn("⚠️ Required fields missing!");
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    if (!govtId && !passportNo && !alienRegNo) {
      console.warn("⚠️ Missing Govt ID / Passport / Alien Reg No");
      return res
        .status(400)
        .json({ success: false, message: "At least one ID is required" });
    }

    // ================= Check Duplicates =================
    const existingEmployee = await EmployeeModel.findOne({
      $or: [
        { officialEmail }, 
        { personalEmail }, 
        { govtId: govtId || null },
        { passportNo: passportNo || null },
        { alienRegNo: alienRegNo || null }
      ].filter(condition => Object.values(condition)[0] != null),
    });

    if (existingEmployee) {
      console.warn("⚠️ Duplicate employee found:", existingEmployee.employeeId);
      return res
        .status(400)
        .json({ success: false, message: "Employee already exists" });
    }

    // ================= Parse Nested JSON =================
    const parsedAddress =
      typeof address === "string" ? JSON.parse(address) : address || {};
    const parsedSalary =
      typeof salary === "string" ? JSON.parse(salary) : salary || {};
    const parsedTenure =
      typeof tenure === "string" ? JSON.parse(tenure) : tenure || {};
    const parsedTransfers =
      typeof transfers === "string" ? JSON.parse(transfers) : transfers || [];
    const parsedChangeOfStatus =
      typeof changeOfStatus === "string"
        ? JSON.parse(changeOfStatus)
        : changeOfStatus || {};
    const parsedHistory =
      typeof employmentHistory === "string"
        ? JSON.parse(employmentHistory)
        : employmentHistory || {};

    console.log("✅ Parsed nested objects:", {
      parsedAddress,
      parsedSalary,
      parsedTenure,
      parsedTransfers,
      parsedChangeOfStatus,
      parsedHistory,
    });

    // ================= Build Employee Object =================
    const employeeData = {
      individualName,
      fatherName,
      qualification,
      dob: new Date(dob),
      govtId,
      passportNo,
      alienRegNo,
      officialEmail,
      personalEmail,
      previousOrgEmail,
      address: parsedAddress,
      employmentHistory: parsedHistory,
      employmentStatus,
      tenure: parsedTenure,
      salary: parsedSalary,
      changeOfStatus: parsedChangeOfStatus,
      transfers: parsedTransfers,
      DraftStatus: { status: "Draft", PostStatus: "Not Assigned" },
      finalizationStatus: "Pending",
      ...(uploadedImage && {
        avatar: {
          url: uploadedImage.secure_url,
          public_id: uploadedImage.public_id,
        },
      }),
      // ...(uploadedSalaryAttachment && { salaryAttachment: { url: uploadedSalaryAttachment.secure_url, public_id: uploadedSalaryAttachment.public_id } }),
    };

    console.log("🛠️ Final employeeData before save:", employeeData);

    // ================= Save Employee =================
    const newEmployee = new EmployeeModel(employeeData);

    await newEmployee.validate();
    console.log("✅ Employee validation passed");

    await newEmployee.save();
    console.log("💾 Employee saved successfully:", newEmployee._id);

    return res.status(201).json({
      success: true,
      message: "Employee registered successfully",
      employeeId: newEmployee._id,
    });
  } catch (error) {
    console.error("🔥 RegisterEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const SubmitEmployee = async (req, res) => {
  try {
    const { employeeId, orgUnitId } = req.body;
    if (!employeeId || !orgUnitId) {
      return res
        .status(400)
        .json({ success: false, message: "employeeId and orgUnitId are required" });
    }

    // 1️⃣ Find draft employee
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    // 2️⃣ Duplicate check in finalized employees
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
      return res.status(400).json({
        success: false,
        message: "Duplicate employee exists in finalized employees",
      });
    }

    // 3️⃣ Update draft employee
    employee.DraftStatus.status = "Submitted";
    employee.finalizationStatus = "Pending";
    await employee.save();

    // 4️⃣ Find assigned role (one per employee)
    const assignedRole = await RoleModel.findOne({ employeeId: employee._id });
    if (!assignedRole) {
      return res.status(400).json({
        success: false,
        message: "Cannot submit employee: No role assigned",
      });
    }

    // 5️⃣ Verify orgUnit exists
    const orgUnit = await OrgUnitModel.findById(orgUnitId);
    if (!orgUnit) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid orgUnitId" });
    }

    const UserId = await getNextUserId(); 
    employee.UserId = UserId;
    employee.save();

    // 6️⃣ Prepare finalized employee (only refs for role + orgUnit)
    const finalizedData = {
      ...employee.toObject(),
      role: assignedRole._id, // reference only
      orgUnit: orgUnit._id,   // reference only
      UserId: UserId,
      profileStatus: {
        submitted: true,
        decision: "Pending",
        passwordCreated: false,
        emailSent: false,
      },
    };

    delete finalizedData.DraftStatus;
    delete finalizedData._id;

    // 7️⃣ Create finalized employee
    const finalizedEmployee = await FinalizedEmployeeModel.create(finalizedData);

    // 8️⃣ Update orgUnit with employee reference
    await OrgUnitModel.findByIdAndUpdate(orgUnitId, {
      employee: finalizedEmployee._id,
    });

    return res.status(200).json({
      success: true,
      message: "Draft submitted successfully and FinalizedEmployee created",
      finalizedEmployeeId: finalizedEmployee._id,
      roleId: assignedRole._id,
      orgUnitId: orgUnit._id,
    });
  } catch (error) {
    console.error("🔥 SubmitEmployee error:", error.stack || error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to submit draft" });
  }
};

export const ApproveEmployee = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) {
      return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });
    }

    const finalizedEmployee = await FinalizedEmployeeModel.findById(finalizedEmployeeId);
    if (!finalizedEmployee) {
      return res.status(404).json({ success: false, message: "FinalizedEmployee not found" });
    }

    // 🔑 Generate password
    const tempPassword = generatePassword();
    const passwordHash = await hashPassword(tempPassword);

    // generate the organization id..
    const finalizedEmployee = finalizedEmployee.UserId;
    const organizationId  = generateOrganizationId(finalizedEmployee, id);

    // 1️⃣ Update finalized employee
    finalizedEmployee.profileStatus.decision = "Approved";
    finalizedEmployee.profileStatus.passwordCreated = true;
    finalizedEmployee.passwordHash = passwordHash;
    finalizedEmployee.password = tempPassword;
    finalizedEmployee.OrganizationId = organizationId;
  
    await finalizedEmployee.save();

    // 2️⃣ Confirm assignment to OrgUnit
    if (finalizedEmployee.orgUnit) {
      await OrgUnitModel.findByIdAndUpdate(finalizedEmployee.orgUnit, { employee: finalizedEmployee._id });
    }

    // 3️⃣ Delete original draft employee
    if (finalizedEmployee._id) {
      await EmployeeModel.findByIdAndDelete(finalizedEmployee._id);
    }

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
    await EmployeeModel.findByIdAndDelete(finalizedEmployee._id);

    // Optional: delete finalizedEmployee document if you want complete cleanup
    await FinalizedEmployeeModel.findByIdAndDelete(finalizedEmployeeId);

    return res.status(200).json({ success: true, message: "Employee rejected and records cleaned successfully" });
  } catch (error) {
    console.error("🔥 RejectEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to reject employee" });
  }
};

// this is for getting the id of the orgunit and orgunit object..
export const resolveOrgUnit = async (req, res) => {
  try {
    const { office, group, division, department, branch, cell, desk } = req.body;

    // Build path
    const levels = [office, group, division, department, branch, cell, desk].filter(Boolean);

    let parent = null;
    let orgUnit = null;

    for (let level of levels) {
      orgUnit = await OrgUnitModel.findOne({ name: level, parent: parent?._id });

      if (!orgUnit) {
        orgUnit = await OrgUnitModel.create({ name: level, parent: parent?._id });
      }

      parent = orgUnit;
    }

    // keeps checking the orgUnits/nodes until the leaf Node is reached, we return the leaf node..
    
    return res.status(200).json({ success: true, orgUnitId: orgUnit._id, orgUnit });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// roles or assigning posts functions.
export const AssignEmployeePost = async (req, res) => {
  try {
    const { employeeId, roleName, orgUnit, permissions = [] } = req.body;
    console.log(employeeId) ;
    
    // Validate employee
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Validate orgUnit
    const orgUnitDoc = await OrgUnitModel.findById(orgUnit);
    // the orgUnit is created if not existing in the above function and then fetched from frontend..

    if (!orgUnitDoc) {
      return res.status(400).json({ success: false, message: "Invalid orgUnitId" });
    }

    // Handle permissions
    let permissionIds = [];
    if (Array.isArray(permissions) && permissions.length > 0) {
      permissionIds = await Promise.all(
        permissions.map(async (perm) => {
          let p = await PermissionModel.findOne({ name: perm });
          if (!p) p = await PermissionModel.create({ name: perm });
          return p._id;
        })
      );
    }

    // Prevent duplicate role in same orgUnit
    const existing = await RoleModel.findOne({
      employeeId: employee._id,
      roleName,
      orgUnit: orgUnitDoc._id,
    });

    if (existing) {
      return res.status(400).json({ success: false, message: "Role already assigned here" });
    }

    // Create Role
    const newRole = new RoleModel({
      employeeId: employee._id,
      roleName,
      orgUnit: orgUnitDoc._id,
      permissions: permissionIds,
    });

    employee.DraftStatus.PostStatus = "Assigned";
    await employee.save();
    await newRole.save();

    return res.status(200).json({
      success: true,
      message: "Role assigned successfully",
      role: newRole,
    });
  } catch (error) {
    console.error("🔥 AssignEmployeePost error:", error);
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

export const deleteEmployeeAndFinalized = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) {
      return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });
    }

    // ---------------- Delete Finalized Employee ----------------
    const finalized = await FinalizedEmployeeModel.findById(finalizedEmployeeId);
    if (!finalized) {
      return res.status(404).json({ success: false, message: "Finalized employee not found" });
    }

    // Delete finalized avatar
    if (finalized.avatar?.public_id) {
      try { await destroyImageFromCloudinary(finalized.avatar.public_id); } 
      catch (err) { console.warn("Failed to delete finalized image:", err.message); }
    }

    // Delete finalized role & permissions
    if (finalized.role) {
      const finalizedRole = await RoleModel.findById(finalized.role);
      if (finalizedRole) {
        if (finalizedRole.permissions?.length)
          await PermissionModel.deleteMany({ _id: { $in: finalizedRole.permissions } });
        await RoleModel.findByIdAndDelete(finalizedRole._id);

        if (finalizedRole.orgUnit)
          await OrgUnitModel.findByIdAndUpdate(finalizedRole.orgUnit, { $unset: { role: "" } });
      }
    }

    // Remove OrgUnit reference
    if (finalized.OrgUnit)
      await FinalizedEmployeeModel.findByIdAndUpdate(finalized._id, { $unset: { OrgUnit: "" } });

    // ---------------- Delete Draft Employee (if exists) ----------------
   const employee = await EmployeeModel.findOne({ UserId: finalized.UserId });
    if (employee) {
      // Delete avatar
      if (employee.avatar?.public_id)
        await destroyImageFromCloudinary(employee.avatar.public_id);

      // Delete role & permissions
      if (employee.role) {
        const role = await RoleModel.findById(employee.role);
        if (role) {
          if (role.permissions?.length)
            await PermissionModel.deleteMany({ _id: { $in: role.permissions } });
          await RoleModel.findByIdAndDelete(role._id);

          if (role.orgUnit)
            await OrgUnitModel.findByIdAndUpdate(role.orgUnit, { $unset: { role: "" } });
        }
      }

      // Remove OrgUnit reference
      if (employee.OrgUnit)
        await EmployeeModel.findByIdAndUpdate(employee._id, { $unset: { OrgUnit: "" } });

      // Delete draft employee
      await EmployeeModel.findByIdAndDelete(employee._id);
    }

    // Delete finalized employee
    await FinalizedEmployeeModel.findByIdAndDelete(finalized._id);

    return res.status(200).json({ 
      success: true, 
      message: "Employee, finalized employee, avatars, roles, permissions, and OrgUnit references deleted successfully" 
    });

  } catch (error) {
    console.error("🔥 deleteEmployeeAndFinalized error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to delete employee", error: error.message });
  }
};


// to do: edit all the controllers according to the..new forms and new fields..
// modify the flow,add the new fields, remove the old fields..
// handle edit..
// add the file attachements step: (file attachements in the specific step)..


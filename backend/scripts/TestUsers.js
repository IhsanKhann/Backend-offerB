import mongoose from "mongoose";
import bcrypt from "bcrypt";

import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import RoleModel from "../models/HRModals/Role.model.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";

/************************************
 * ENVIRONMENT GUARD
 ************************************/
if (process.env.NODE_ENV === "production") {
  throw new Error("❌ createTestUsers cannot run in production");
}

/************************************
 * DB CONNECTION
 ************************************/
async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ DB Connected");
}

/************************************
 * MAIN SCRIPT
 ************************************/
async function createTestUsers() {
  await connectDB();

  /* -------------------------------
   * ORG UNITS (UPSERT)
   * ----------------------------- */
  const hrDept = await OrgUnitModel.findOneAndUpdate(
    { code: "HR" },
    {
      name: "HR Department",
      status: "Offices",
      level: 0
    },
    { upsert: true, new: true }
  );

  const financeDept = await OrgUnitModel.findOneAndUpdate(
    { code: "Finance" },
    {
      name: "Finance Department",
      status: "Offices",
      level: 0
    },
    { upsert: true, new: true }
  );

  /* -------------------------------
   * ROLES
   * ----------------------------- */
  const seniorOfficerRole = await RoleModel.findOne({ roleName: "Senior Officer" });
  const chairmanRole = await RoleModel.findOne({ roleName: "Chairman" });

  if (!seniorOfficerRole || !chairmanRole) {
    throw new Error("❌ Required roles not found");
  }

  /* -------------------------------
   * CREATE USER HELPER
   * ----------------------------- */
  async function createUserIfNotExists(data) {
    const exists = await FinalizedEmployee.findOne({
      officialEmail: data.officialEmail
    });

    if (exists) return exists;

    const passwordHash = await bcrypt.hash(data.password, 10);

    return FinalizedEmployee.create({
      ...data,
      passwordHash
    });
  }

  /* -------------------------------
   * HR SENIOR OFFICER
   * ----------------------------- */
  const hrOfficer = await createUserIfNotExists({
    UserId: "HRSeniorOBE001",
    OrganizationId: "001",
    individualName: "HR Senior Officer",
    fatherName: "Test",
    dob: new Date("1990-01-01"),
    govtId: "12345-6789012-3",
    officialEmail: "hr.senior@offerberries.com",
    personalEmail: "hr.senior@test.com",
    password: "hr123",
    address: { city: "Test City", country: "Test Country", contactNo: "1234567890" },
    employmentStatus: "Permanent",
    salary: { startDate: new Date(), type: "Fixed", amount: 150000 },
    tenure: { joining: new Date() },
    profileStatus: { submitted: true, decision: "Approved", passwordCreated: true },
    role: seniorOfficerRole._id,
    orgUnit: hrDept._id
  });

  await RoleAssignmentModel.findOneAndUpdate(
    { employeeId: hrOfficer._id, roleId: seniorOfficerRole._id },
    {
      departmentCode: "HR",
      status: "Offices",
      orgUnit: hrDept._id,
      effectiveFrom: new Date(),
      isActive: true
    },
    { upsert: true }
  );

  /* -------------------------------
   * FINANCE SENIOR OFFICER
   * ----------------------------- */
  const financeOfficer = await createUserIfNotExists({
    UserId: "FinanceSeniorOBE002",
    OrganizationId: "002",
    individualName: "Finance Senior Officer",
    fatherName: "Test",
    dob: new Date("1990-01-01"),
    govtId: "12345-6789012-4",
    officialEmail: "finance.senior@offerberries.com",
    personalEmail: "finance.senior@test.com",
    password: "finance123",
    address: { city: "Test City", country: "Test Country", contactNo: "1234567890" },
    employmentStatus: "Permanent",
    salary: { startDate: new Date(), type: "Fixed", amount: 150000 },
    tenure: { joining: new Date() },
    profileStatus: { submitted: true, decision: "Approved", passwordCreated: true },
    role: seniorOfficerRole._id,
    orgUnit: financeDept._id
  });

  await RoleAssignmentModel.findOneAndUpdate(
    { employeeId: financeOfficer._id, roleId: seniorOfficerRole._id },
    {
      departmentCode: "Finance",
      status: "Offices",
      orgUnit: financeDept._id,
      effectiveFrom: new Date(),
      isActive: true
    },
    { upsert: true }
  );

  /* -------------------------------
   * CHAIRMAN
   * ----------------------------- */
  const chairman = await createUserIfNotExists({
    UserId: "ChairmanOBE003",
    OrganizationId: "003",
    individualName: "Chairman",
    fatherName: "Test",
    dob: new Date("1960-01-01"),
    govtId: "12345-6789012-5",
    officialEmail: "chairman@offerberries.com",
    personalEmail: "chairman@test.com",
    password: "chairman123",
    address: { city: "Test City", country: "Test Country", contactNo: "1234567890" },
    employmentStatus: "Permanent",
    salary: { startDate: new Date(), type: "Fixed", amount: 500000 },
    tenure: { joining: new Date() },
    profileStatus: { submitted: true, decision: "Approved", passwordCreated: true },
    role: chairmanRole._id,
    orgUnit: hrDept._id
  });

  await RoleAssignmentModel.findOneAndUpdate(
    { employeeId: chairman._id, roleId: chairmanRole._id },
    {
      departmentCode: "ALL",
      status: "Offices",
      orgUnit: hrDept._id,
      effectiveFrom: new Date(),
      isActive: true
    },
    { upsert: true }
  );

  console.log("✅ Test users ready");
  await mongoose.disconnect();
}

createTestUsers().catch(console.error);

import mongoose from "mongoose";
// import bcrypt from "bcrypt";

// ================= Address =================
const addressSchema = new mongoose.Schema({
  houseNo: { type: String },
  addressLine: { type: String },
  streetNo: { type: String },
  road: { type: String },
  city: { type: String, required: true },
  state: { type: String },
  country: { type: String, required: true },
  contactNo: { type: String, required: true },
  email: { type: String },
});

// ================= Employment History =================
const employmentHistorySchema = new mongoose.Schema({
  orgName: { type: String },
  releaseDate: { type: Date },
  designation: { type: String },
  organizationsWorkedFor: { type: String },
});

// ================= Salary =================
const salarySchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  type: {
    type: String,
    enum: ["Initial", "Incremented", "Special", "Fixed", "Internship"],
    required: true,
  },
  amount: { type: Number, required: true },
  terminalBenefits: [{ type: String }],
  terminalBenefitDetails: { type: String },
  NumberofIncerements: { type: String },
  // avatarSalaryAttachement: {
  //   url: { type: String },
  //   public_id: { type: String }
  // }
});

// ================= Tenure =================
const tenureSchema = new mongoose.Schema({
  joining: { type: Date, required: true },
  confirmation: { type: Date },
  retirement: { type: Date },
  contractExpiryOrRenewal: { type: Date },
  promotion: { type: Date },
  otherEventDate: { type: Date },
});

// ================= Status Change =================
const statusChangeSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: [
      "Suspended → Restored",
      "Retired → Re-employed",
      "Terminated → Re-employed",
      "Dismissed → Re-employed",
    ],
  },
  date: { type: Date },
});

// ================= Transfers =================
const transferSchema = new mongoose.Schema({
  department: { type: String },
  division: { type: String },
  group: { type: String },
  branch: { type: String },
  city: { type: String },
  country: { type: String },
  immediateBoss: { type: String },
  date: { type: Date, default: Date.now },
});

// ================= Draft Status =================
const DraftStatus = new mongoose.Schema({
  status: { type: String, enum: ["Draft", "Submitted"], default: "Draft" },
  PostStatus: {
    type: String,
    enum: ["Assigned", "Not Assigned"],
    default: "Not Assigned",
  },
});

const employeeBankingSchema = new mongoose.Schema({
  bankName: { type: String },
  accountTitle: { type: String },
  accountNumber: { type: String },
  iban: { type: String },
  branchCode: { type: String },
  cnic: { type: String },
  mobile: { type: String },
});

// ================= Employee =================
const employeeSchema = new mongoose.Schema(
  {
    UserId: { type: String }, 
    individualName: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    qualification: { type: String },
    dob: { type: Date, required: true },
    govtId: { type: String },
    passportNo: { type: String },
    alienRegNo: { type: String },

    officialEmail: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    personalEmail: { type: String, required: true, lowercase: true, trim: true },
    previousOrgEmail: { type: String, lowercase: true, trim: true },

    avatar: {
      public_id: { type: String },
      url: { type: String },
    },

    address: { type: addressSchema, required: true },
    employmentHistory: { type: employmentHistorySchema, default: {} },
    employmentStatus: {
      type: String,
      enum: ["Permanent", "Contract", "Intern", "Outsourced", "Probation"],
      required: true,
    },

    salary: { type: salarySchema, required: true },
    tenure: { type: tenureSchema, required: true },
    changeOfStatus: { type: statusChangeSchema, default: {} },
    transfers: { type: [transferSchema], default: [] },
    DraftStatus: { type: DraftStatus, default: {} },

    finalizationStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    role: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: "roles",
    },
    orgUnit: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: "OrgUnit",
    },

    // right now by default empty object is being created..
    bankingDetails: { type: employeeBankingSchema, default: {} },
  },
  { timestamps: true }
);

// Custom validator for Govt ID / Passport / Alien Reg
employeeSchema.pre("validate", function (next) {
  console.log("🔍 Pre-validate hook triggered for employee:", this.individualName);

  const hasAnyId = !!(this.govtId || this.passportNo || this.alienRegNo);
  if (!hasAnyId) {
    console.warn("⚠️ Missing Government ID/Passport/AlienRegNo");
    return next(
      new Error(
        "At least one Government ID (CNIC/SSN), Passport No, or Alien Registration No is required."
      )
    );
  }

  console.log("✅ Government ID validation passed");
  next();
});

export default mongoose.model("Employee", employeeSchema);

// models/finalizedEmployee.model.js
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

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

const employmentHistorySchema = new mongoose.Schema({
  orgName: { type: String },
  releaseDate: { type: Date },
  designation: { type: String },
  organizationsWorkedFor: { type: String },
});

const salaryDetailSchema = new mongoose.Schema({
  type: { type: String },         // e.g., "Allowance", "Deduction", "Bonus"
  name: { type: String },         // e.g., "Gratuity Fund"
  value: { type: Number, default: 0 },
  calculation: { type: String },  // optional: "percentage of base", etc.
});

const salarySchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  type: {
    type: String,
    enum: ["Initial", "Incremented", "Special", "Fixed", "Internship"],
    required: true,
  },
  amount: { type: Number, required: true },

  // Terminal Benefit Tracking (Accumulative)
  terminalBenefits: {
    gratuity: { type: Number, default: 0 },              // accumulative
    providentFund: { type: Number, default: 0 },         // accumulative
    eobi: { type: Number, default: 0 },                  // accumulative
    costOfFunds: { type: Number, default: 0 },           // accumulative
    groupTermInsurance: { type: Number, default: 0 },    // accumulative
    otherBenefits: { type: Number, default: 0 },         // accumulative
  },

  // Optional description fields
  terminalBenefitDetails: { type: String },
});

const tenureSchema = new mongoose.Schema({
  joining: { type: Date, required: true },
  confirmation: { type: Date },
  retirement: { type: Date },
  contractExpiryOrRenewal: { type: Date },
  promotion: { type: Date },
  otherEventDate: { type: Date },
});

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
  NumberofIncerements: {type: String},
  // AttachmentFile: {type: String},
  date: { type: Date },
});

const transferSchema = new mongoose.Schema({
  department: { type: String },
  division: { type: String },
  group: { type: String },
  branch: { type: String },
  city: { type: String },
  country: { type: String },
  immediateBoss: { type: String },
  date: { type: Date, default: Date.now },
  TransferPermissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }],
  TransferRole : { type: mongoose.Schema.Types.ObjectId, ref: "roles" },
});

// Embedded schema for profile status
const profileStatusSchema = new mongoose.Schema({
  submitted: { type: Boolean, default: true }, // always true for finalized
  decision: { 
    type: String,
    enum: ["Approved", "Rejected", "Pending", "Suspended", "Blocked", "Terminated", "Restored"], 
    default: "Pending" 
  },
  passwordCreated: { type: Boolean, default: false },
  emailSent: { type: Boolean, default: false },
});

const LeaveSchema = new mongoose.Schema({
  onLeave: {type: Boolean, default: false},
  leaveType: {type: String},
  leaveReason: {type: String},
  leaveStartDate: {type: Date},
  leaveEndDate: {type: Date},  
  leaveAccepted : {type: Boolean, default: false},
  leaveRejected : {type: Boolean, default: false},
  RejectionLeaveReason : {type: String},
  RejectedBy : {type: String},

  transferredRoleTo: { type: mongoose.Schema.Types.ObjectId, ref: "FinalizedEmployee" },
});

const SuspensionSchema = new mongoose.Schema({
  suspensionReason : {type: String},
  suspensionStartDate: {type: Date},
  suspensionEndDate: {type: Date},
});

const BlockedSchema = new mongoose.Schema({
  blockReason : {type: String},
  blockStartDate: {type: Date},
  blockEndDate: {type: Date},
});

const TerminatedSchema = new mongoose.Schema({
  terminationReason : {type: String},
  terminationStartDate: {type: Date},
  terminationEndDate: {type: Date},
});

const employeeBankingSchema = new mongoose.Schema({
  bankName: { type: String },
  accountTitle: { type: String },
  accountNumber: { type: String },
  iban: { type: String },
  branchCode: { type: String },
  cnic: { type: String },
});

const finalizedEmployeeSchema = new mongoose.Schema(
  {
    // 1. Personal Details
    UserId: { type: String }, //comes from the employee..
    OrganizationId : {type: String}, 
    // this id is assigned when the employee is approved.

    individualName: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    qualification: { type: String },
    dob: { type: Date, required: true },
    govtId: { type: String },
    passportNo: { type: String },
    alienRegNo: { type: String },

    officialEmail: { type: String, required: true, lowercase: true, trim: true },
    
    passwordHash: { type: String }, // system-generated
    password: {type:String },

    personalEmail: { type: String, required: true, lowercase: true, trim: true },
    previousOrgEmail: { type: String, lowercase: true, trim: true },

     // image here:
    avatar: {
        public_id: {
            type: String,
        },
        url: {
            type: String,
        },
    },

    rolePermissionsBackup: [
      { type: mongoose.Schema.Types.ObjectId, ref: "permissions" }
    ],
    previous_status: { type: String },
    previous_role: { type: mongoose.Schema.Types.ObjectId, ref: "roles" },

    leave: {type: LeaveSchema, default: {}},
    suspension: {type: SuspensionSchema, default: {}},
    blocked : {type: BlockedSchema, default : {}},
    terminated : {type: TerminatedSchema, default : {}},

    // 2. Address
    address: { type: addressSchema, required: true },

    // 3. Profile & Employment History
    employmentHistory: { type: employmentHistorySchema, default: {} },

    // 4. Employment Status
    employmentStatus: {
      type: String,
      enum: ["Permanent", "Contract", "Intern", "Outsourced", "Probation"],
      required: true,
    },

    // 5. Posting Information
    // posting: { type: AppointmentSchema, required: true }, // if needed

    // 6. Roles
    role: { type: mongoose.Schema.Types.ObjectId, ref: "roles"},
    orgUnit: { type: mongoose.Schema.Types.ObjectId, ref: "OrgUnit", required: true },

    // 7. Salary & Benefits
    salary: { type: salarySchema, required: true },

    // 8. Tenure
    tenure: { type: tenureSchema, required: true },

    // 9. Change of Status
    changeOfStatus: { type: statusChangeSchema, default: {} },

    // 10. Transfers
    transfers: { type: [transferSchema], default: [] },

    // 11. Final Submission Info
    profileStatus: { type: profileStatusSchema, default: () => ({}) },

    // 12. Employee Banking Details: by default empty object is being created..
    bankingDetails: { type: employeeBankingSchema, default: {} },

     refreshToken: {
        type: String,
      }
  },
  { timestamps: true }
);

// Validator: require at least one government ID
finalizedEmployeeSchema.pre("validate", function (next) {
  const hasAnyId = !!(this.govtId || this.passportNo || this.alienRegNo);
  if (!hasAnyId) {
    return next(new Error("At least one Government ID (CNIC/SSN), Passport No, or Alien Registration No is required."));
  }
  next();
});

finalizedEmployeeSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)
    next()
});

finalizedEmployeeSchema.methods.comparePassword = async function(candidatePassword){
    return await bcrypt.compare(candidatePassword, this.passwordHash)
};

finalizedEmployeeSchema.methods.generateAccessToken = function(){
    console.log("Access Secret:", process.env.ACCESS_TOKEN_SECRET);
    console.log("Access Expiry:",  process.env.ACCESS_TOKEN_EXPIRY);

    
    return jwt.sign(
        {
            _id: this._id,
            email: this.personalEmail,
            OrganizationId: this.OrganizationId,
            UserId: this.UserId,
            individualName: this.individualName
        },

       process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:  process.env.ACCESS_TOKEN_EXPIRY
        }
    );
};

finalizedEmployeeSchema.methods.generateRefreshToken = function(){
        return jwt.sign(
        {
            _id: this._id,
            UserId: this.UserId,
            OrganizationId: this.OrganizationId,
        },
      process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
};

export default mongoose.model("FinalizedEmployee", finalizedEmployeeSchema);

// models/finalizedEmployee.model.js
import mongoose from "mongoose";

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
});

// Embedded schema for profile status
const profileStatusSchema = new mongoose.Schema({
  submitted: { type: Boolean, default: true }, // always true for finalized
  decision: { 
    type: String,
    enum: ["Approved", "Rejected", "Pending"], 
    default: "Pending" 
  },
  passwordCreated: { type: Boolean, default: false },
  emailSent: { type: Boolean, default: false },
});

const finalizedEmployeeSchema = new mongoose.Schema(
  {
    // 1. Personal Details
    employeeId: { type: String, required: true},
    individualName: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    qualification: { type: String },
    dob: { type: Date, required: true },
    govtId: { type: String },
    passportNo: { type: String },
    alienRegNo: { type: String },

    officialEmail: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String }, // system-generated
    password: {type:String},
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
    role: {
      type: String,
      enum: [
        "Chairman",
        "BoD Member",
        "Company Secretary",
        "Group Head / Division Head / Department Head",
        "Branch Manager",
        "Officer / Manager / Senior Manager",
        "Cell Incharge",
        "Executive (Contract / Permanent)",
        "Senior Group Head",
      ],
      required: true,
    },

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

export default mongoose.model("FinalizedEmployee", finalizedEmployeeSchema);

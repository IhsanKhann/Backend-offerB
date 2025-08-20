// models/employee.model.js
import mongoose from "mongoose";
// import bcrypt from "bcrypt";

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
  employeeId: { type: String }, // You may enforce unique elsewhere if needed
  orgName: { type: String },
  releaseDate: { type: Date },
  designation: { type: String },
  organizationsWorkedFor: { type: String }, // free text list
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
  otherEventDate: { type: Date }, // Retrenchment / Termination / Suspension / Death
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

const profileSubmissionSchema = new mongoose.Schema({
  submitted: { type: Boolean, default: false },
  decision: { 
    type: String,
    enum: ["Approved", "Rejected", "Pending"], 
    default: "Pending" 
  },
  passwordCreated: { type: Boolean, default: false },
  emailSent: { type: Boolean, default: false },
});

const employeeSchema = new mongoose.Schema(
  {
    // 1. Personal Details
    individualName: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    qualification: { type: String }, // "Qualification / Ongoing Qualification"
    dob: { type: Date, required: true },
    govtId: { type: String }, // Social Security / CNIC / Govt. ID
    passportNo: { type: String },
    alienRegNo: { type: String }, // Green Card / Alien Registration No.

    officialEmail: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String }, // system-generated & stored securely
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
    // posting: { type: AppointmentSchema, required: true }, this has its own model now.

    // 6. Starting Cadres / User Roles
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

    // 11. Final Submission
    profileSubmission: { type: profileSubmissionSchema, default: {} },
  },
  { timestamps: true }
);

// Custom validator: require at least one government ID: govtId OR passportNo OR alienRegNo
employeeSchema.pre("validate", function (next) {
  const hasAnyId = !!(this.govtId || this.passportNo || this.alienRegNo);
  if (!hasAnyId) {
    return next(new Error("At least one Government ID (CNIC/SSN), Passport No, or Alien Registration No is required."));
  }
  next();
});

export default mongoose.model("Employee", employeeSchema);

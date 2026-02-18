import mongoose from "mongoose";

const BranchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },

  location: {
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    postalCode: { type: String, default: "" }
  },

  isHeadOffice: {
    type: Boolean,
    default: false,
    index: true
  },

  branchType: {
    type: String,
    enum: ["HeadOffice", "Regional", "Local", "Manufacturing"],
    default: "Local"
  },

  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FinalizedEmployee",
    default: null
  },

  contactInfo: {
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    fax: { type: String, default: "" }
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  openedDate: {
    type: Date,
    default: null
  },

  closedDate: {
    type: Date,
    default: null
  },

  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }

}, { 
  timestamps: true 
});

BranchSchema.index({ code: 1, isActive: 1 });
BranchSchema.index({ isHeadOffice: 1 });
BranchSchema.index({ branchType: 1 });

BranchSchema.virtual('orgUnits', {
  ref: 'OrgUnit',
  localField: '_id',
  foreignField: 'branchId'
});

BranchSchema.virtual('employees', {
  ref: 'RoleAssignment',
  localField: '_id',
  foreignField: 'branchId',
  match: { isActive: true }
});

BranchSchema.methods.getEmployeeCount = async function() {
  const RoleAssignmentModel = mongoose.model('RoleAssignment');
  return await RoleAssignmentModel.countDocuments({
    branchId: this._id,
    isActive: true
  });
};

BranchSchema.methods.getDepartmentBreakdown = async function() {
  const RoleAssignmentModel = mongoose.model('RoleAssignment');
  
  return await RoleAssignmentModel.aggregate([
    { $match: { branchId: this._id, isActive: true } },
    { $group: { 
      _id: "$departmentCode", 
      count: { $sum: 1 } 
    }},
    { $sort: { count: -1 } }
  ]);
};

BranchSchema.statics.getHeadOffice = function() {
  return this.findOne({ isHeadOffice: true, isActive: true });
};

BranchSchema.statics.getActive = function() {
  return this.find({ isActive: true }).sort({ code: 1 });
};

BranchSchema.statics.seedDefaults = async function() {
  const headOffice = await this.findOne({ isHeadOffice: true });
  
  if (!headOffice) {
    await this.create({
      name: "Head Office",
      code: "HQ",
      isHeadOffice: true,
      branchType: "HeadOffice",
      isActive: true
    });
    
    console.log("✅ Head Office branch created");
  }
};

export const BranchModel = mongoose.model("Branch", BranchSchema);
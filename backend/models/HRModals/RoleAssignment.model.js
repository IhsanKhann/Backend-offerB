import mongoose from "mongoose";

const RoleAssignmentSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinalizedEmployee",
      required: true,
      index: true
    },

    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      index: true
    },

    departmentCode: {
      type: String,
      enum: ["HR", "Finance", "BusinessOperation", "IT", "Compliance", "All"],
      required: true,
      index: true
    },

    orgUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUnit",
      required: true,
      index: true
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true
    },

    effectiveFrom: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
    },

    effectiveUntil: {
      type: Date,
      default: null,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinalizedEmployee",
      default: null
    },

    assignedAt: {
      type: Date,
      default: Date.now,
    },

    notes: {
      type: String,
      default: "",
    },

    salaryOverride: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    permissionOverrides: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
    }],

  },
  {
    timestamps: true,
  }
);

// Indexes
RoleAssignmentSchema.index({ employeeId: 1, isActive: 1 });
RoleAssignmentSchema.index({ roleId: 1, departmentCode: 1, isActive: 1 });
RoleAssignmentSchema.index({ orgUnit: 1, isActive: 1 });
RoleAssignmentSchema.index({ branchId: 1, isActive: 1 });
RoleAssignmentSchema.index({ departmentCode: 1, branchId: 1, isActive: 1 });
RoleAssignmentSchema.index({ effectiveFrom: 1, effectiveUntil: 1 });

// One active assignment per employee
RoleAssignmentSchema.index(
  { employeeId: 1, isActive: 1 },
  { 
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

// Virtuals
RoleAssignmentSchema.virtual('isExpired').get(function() {
  if (!this.effectiveUntil) return false;
  return new Date() > this.effectiveUntil;
});

RoleAssignmentSchema.virtual('isExecutiveAccess').get(function() {
  return this.departmentCode === "All";
});

// Methods
RoleAssignmentSchema.methods.deactivate = async function() {
  this.isActive = false;
  this.effectiveUntil = new Date();
  return this.save();
};

RoleAssignmentSchema.methods.getEffectivePermissions = async function() {
  await this.populate('roleId');
  await this.populate('permissionOverrides');
  
  const rolePermissions = this.roleId?.permissions || [];
  const overrides = this.permissionOverrides || [];
  
  const allPermissions = [...rolePermissions, ...overrides];
  const uniqueIds = new Set();
  
  return allPermissions.filter(p => {
    const id = p._id.toString();
    if (uniqueIds.has(id)) return false;
    uniqueIds.add(id);
    return true;
  });
};

RoleAssignmentSchema.methods.appliesToDepartment = function(targetDepartment) {
  if (this.departmentCode === "All") return true;
  return this.departmentCode === targetDepartment;
};

// Statics
RoleAssignmentSchema.statics.getActiveForEmployee = function(employeeId) {
  return this.findOne({ 
    employeeId, 
    isActive: true 
  })
    .populate('roleId')
    .populate('orgUnit')
    .populate('branchId');
};

RoleAssignmentSchema.statics.getByDepartment = function(departmentCode) {
  const filter = { isActive: true };
  
  if (departmentCode !== "All") {
    filter.departmentCode = departmentCode;
  }
  
  return this.find(filter)
    .populate('employeeId', 'individualName personalEmail UserId')
    .populate('roleId', 'roleName category')
    .populate('orgUnit', 'name type')
    .populate('branchId', 'name code');
};

RoleAssignmentSchema.statics.getByBranch = function(branchId) {
  return this.find({ 
    branchId, 
    isActive: true 
  })
    .populate('employeeId', 'individualName personalEmail')
    .populate('roleId', 'roleName')
    .populate('orgUnit', 'name');
};

RoleAssignmentSchema.statics.getByOrgUnitTree = async function(orgUnitId) {
  const OrgUnitModel = mongoose.model('OrgUnit');
  const rootUnit = await OrgUnitModel.findById(orgUnitId);
  
  if (!rootUnit) return [];
  
  const pathRegex = new RegExp(`^${rootUnit.path}`);
  const descendantUnits = await OrgUnitModel.find({ 
    path: pathRegex, 
    isActive: true 
  });
  
  const unitIds = descendantUnits.map(u => u._id);
  
  return this.find({
    orgUnit: { $in: unitIds },
    isActive: true
  })
    .populate('employeeId', 'individualName personalEmail UserId')
    .populate('roleId', 'roleName category')
    .populate('orgUnit', 'name type')
    .populate('branchId', 'name code');
};

const RoleAssignmentModel = mongoose.model("RoleAssignment", RoleAssignmentSchema);
export default RoleAssignmentModel;
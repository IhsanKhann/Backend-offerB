// models/HRModals/OrgUnit.js
import mongoose from "mongoose";

const OrgUnitSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  
  type: {
    type: String,
    enum: [
      "ORG_ROOT",      // Chairman
      "BOARD",         // Board of Directors
      "EXECUTIVE",     // CEO
      "DIVISION",      // Finance Division, HR Division
      "DEPARTMENT",    // Commercial Operation, Taxes Division
      "DESK",          // Retail Disbursement, Staff Expenses
      "CELL"           // Individual cells
    ],
    required: true,
    index: true
  },

  departmentCode: {
    type: String,
    enum: ["HR", "Finance", "BusinessOperation", "IT", "Compliance", "All"],
    required: true,
    index: true,
    default: "All"
  },

  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OrgUnit",
    default: null,
    index: true
  },

  path: {
    type: String,
    required: true,
    index: true,
    default: ""
  },

  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 7, // Fixed max level to 7
    index: true
  },

  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    default: null,
    index: true
  },

  isGlobal: {
    type: Boolean,
    default: false,
    index: true
  },

  roleAssignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RoleAssignment",
    required: false
  },

  description: {
    type: String,
    default: ""
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }

}, { 
  timestamps: true 
});

// Indexes
OrgUnitSchema.index({ parent: 1, level: 1 });
OrgUnitSchema.index({ type: 1, departmentCode: 1 });
OrgUnitSchema.index({ branchId: 1, isActive: 1 });
OrgUnitSchema.index({ path: 1, isActive: 1 });

// Virtuals
OrgUnitSchema.virtual('children', {
  ref: 'OrgUnit',
  localField: '_id',
  foreignField: 'parent'
});

OrgUnitSchema.virtual('employees', {
  ref: 'RoleAssignment',
  localField: '_id',
  foreignField: 'orgUnit',
  match: { isActive: true }
});

OrgUnitSchema.virtual('employeeCount', {
  ref: 'RoleAssignment',
  localField: '_id',
  foreignField: 'orgUnit',
  count: true,
  match: { isActive: true }
});

// Methods
OrgUnitSchema.methods.buildPath = async function() {
  if (!this.parent) {
    this.path = this.name.toLowerCase().replace(/\s+/g, '_');
    return this.path;
  }

  const parent = await this.constructor.findById(this.parent);
  if (!parent) {
    this.path = this.name.toLowerCase().replace(/\s+/g, '_');
    return this.path;
  }

  this.path = `${parent.path}.${this.name.toLowerCase().replace(/\s+/g, '_')}`;
  return this.path;
};

OrgUnitSchema.methods.getDescendants = async function() {
  const pathRegex = new RegExp(`^${this.path}\\.`);
  return await this.constructor.find({ 
    path: pathRegex, 
    isActive: true 
  });
};

OrgUnitSchema.methods.getAncestors = async function() {
  const ancestors = [];
  let current = this;

  while (current.parent) {
    current = await this.constructor.findById(current.parent);
    if (!current) break;
    ancestors.unshift(current);
  }

  return ancestors;
};

OrgUnitSchema.methods.isAncestorOf = function(target) {
  const targetPath = typeof target === 'string' ? target : target.path;
  return targetPath.startsWith(this.path + '.');
};

OrgUnitSchema.methods.isDescendantOf = function(target) {
  const targetPath = typeof target === 'string' ? target : target.path;
  return this.path.startsWith(targetPath + '.');
};

// Hooks
OrgUnitSchema.pre('save', async function(next) {
  try {
    if (this.parent) {
      const parent = await this.constructor.findById(this.parent);
      if (!parent) throw new Error(`Parent not found for OrgUnit "${this.name}"`);
      this.level = parent.level + 1;
    }
    await this.buildPath();
    if (!this.path) throw new Error('Path could not be generated');
    next();
  } catch (error) {
    next(error);
  }
});

OrgUnitSchema.pre('remove', async function(next) {
  const childCount = await this.constructor.countDocuments({ 
    parent: this._id 
  });

  if (childCount > 0) {
    throw new Error(
      `Cannot delete org unit with ${childCount} children. Delete children first.`
    );
  }

  next();
});

// Statics
OrgUnitSchema.statics.getRoots = function() {
  return this.find({ parent: null, isActive: true }).sort({ level: 1, name: 1 });
};

OrgUnitSchema.statics.getTree = async function(rootId = null) {
  const buildTree = async (parentId) => {
    const nodes = await this.find({ 
      parent: parentId, 
      isActive: true 
    }).sort({ level: 1, name: 1 });

    return Promise.all(
      nodes.map(async (node) => ({
        ...node.toObject(),
        children: await buildTree(node._id)
      }))
    );
  };

  return buildTree(rootId);
};

OrgUnitSchema.statics.findByPathPattern = function(pathPattern) {
  const regex = new RegExp(pathPattern);
  return this.find({ path: regex, isActive: true });
};

export const OrgUnitModel = mongoose.model('OrgUnit', OrgUnitSchema);

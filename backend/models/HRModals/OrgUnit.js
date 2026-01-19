import mongoose from "mongoose";

const OrgUnitSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OrgUnit",
    default: null // root nodes have null parent
  },

  // Reference to Role Assignment (not Role Declaration)
  roleAssignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RoleAssignment",
    required: false
  },

  // Status - derived from hierarchy level
  status: {
    type: String,
    enum: ["Offices", "Groups", "Divisions", "Departments", "Branches", "Cells"],
    required: true,
  },

  // Department code for notification isolation
  code: {
    type: String,
    enum: ["HR", "Finance", "BusinessOperation"],
    required: true,
  },

  // Hierarchy metadata
  level: {
    type: Number,
    default: 0, // 0 = root, 1 = first level, etc.
  },

  // Additional metadata
  description: {
    type: String,
    default: "",
  },

  isActive: {
    type: Boolean,
    default: true,
  },

}, { 
  timestamps: true 
});

// Indexes for performance
OrgUnitSchema.index({ parent: 1 });
OrgUnitSchema.index({ code: 1 });
OrgUnitSchema.index({ status: 1 });
OrgUnitSchema.index({ code: 1, status: 1 });
OrgUnitSchema.index({ level: 1 });

// Virtual for children
OrgUnitSchema.virtual('children', {
  ref: 'OrgUnit',
  localField: '_id',
  foreignField: 'parent'
});

export const OrgUnitModel = mongoose.model("OrgUnit", OrgUnitSchema);
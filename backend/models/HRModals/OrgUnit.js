import mongoose from "mongoose";

const OrgUnitSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OrgUnit",
    default: null
  },

  roleAssignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RoleAssignment",
    required: false
  },

  level: {
    type: Number,
    default: 0,
  },

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

OrgUnitSchema.index({ parent: 1 });
OrgUnitSchema.index({ level: 1 });
OrgUnitSchema.index({ name: 1 });
OrgUnitSchema.index({ isActive: 1 });

OrgUnitSchema.virtual('children', {
  ref: 'OrgUnit',
  localField: '_id',
  foreignField: 'parent'
});

export const OrgUnitModel = mongoose.model("OrgUnit", OrgUnitSchema);
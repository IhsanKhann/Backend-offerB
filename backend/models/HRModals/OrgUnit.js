import mongoose from "mongoose";

const OrgUnitSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Head Office", "Finance Desk"
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OrgUnit",
    default: null // root nodes have null parent
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "roles", // role assigned to this unit
    required: false
  }
}, { timestamps: true });

export const OrgUnitModel = mongoose.model("OrgUnit", OrgUnitSchema);

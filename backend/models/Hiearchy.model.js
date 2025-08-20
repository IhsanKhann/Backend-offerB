import mongoose from "mongoose";

const CellSchema = new mongoose.Schema({
  name: { type: String, required: true },
});

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cells: [CellSchema],
});

const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  groups: [GroupSchema],
});

const DivisionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  departments: [DepartmentSchema],
});

const HierarchySchema = new mongoose.Schema({
  divisions: [DivisionSchema],
}, { timestamps: true });

export const HierarchyModel = mongoose.model("Hierarchy", HierarchySchema);

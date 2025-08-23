import mongoose from "mongoose";

const DeskSchema = new mongoose.Schema({
  name: { type: String, required: true }
});

const CellSchema = new mongoose.Schema({
  name: { type: String, required: true },
  desks: [DeskSchema]
});

const BranchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cells: [CellSchema]
});

const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  branches: [BranchSchema],
  cells: [CellSchema],
  desks: [DeskSchema]
});

const DivisionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  departments: [DepartmentSchema]
});

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  divisions: [DivisionSchema]
});

const OfficeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  groups: [GroupSchema],
  divisions: [DivisionSchema],
  departments: [DepartmentSchema],
  branches: [BranchSchema],
  cells: [CellSchema],
  desks: [DeskSchema]
});

const HierarchySchema = new mongoose.Schema({
  offices: [OfficeSchema]
}, { timestamps: true });

export const HierarchyModel = mongoose.model("Hierarchy", HierarchySchema);

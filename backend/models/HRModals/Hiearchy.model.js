import mongoose from "mongoose";

const DeskSchema = new mongoose.Schema({
  name: { type: String, required: true }
});

const CellSchema = new mongoose.Schema({
  name: { type: String, required: true },
  desks: [DeskSchema]
});

// Forward declaration for recursion
const DepartmentSchema = new mongoose.Schema({ name: String }, { _id: false });

const BranchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // Branches can have nested Departments
  departments: [DepartmentSchema],
  // Or Branches can directly have Cells
  cells: [CellSchema],
  // Or even Desks directly (if your document has this case)
  desks: [DeskSchema]
});

// Now redefine DepartmentSchema with recursion fully
DepartmentSchema.add({
  name: { type: String, required: true },
  // Option 1: Department → Branches → (Departments/Cells/Desks)
  branches: [BranchSchema],
  // Option 2: Department → Cells → Desks
  cells: [CellSchema],
  // Option 3: Department → Desks directly
  desks: [DeskSchema]
});

const DivisionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  departments: [DepartmentSchema],
  // Support inconsistency → Divisions can also have direct Cells/Desks
  cells: [CellSchema],
  desks: [DeskSchema]
});

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  divisions: [DivisionSchema],
  // Optional: groups may directly hold departments if needed
  departments: [DepartmentSchema],
  cells: [CellSchema],
  desks: [DeskSchema]
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

const HierarchySchema = new mongoose.Schema(
  {
    offices: [OfficeSchema]
  },
  { timestamps: true }
);

export const HierarchyModel = mongoose.model("Hierarchy", HierarchySchema);

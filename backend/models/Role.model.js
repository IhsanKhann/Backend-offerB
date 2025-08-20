// models/role.model.js
import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    division: { type: String },  // optional
    department: { type: String }, // optional
    group: { type: String },      // optional
    branch: { type: String },     // optional
    city: { type: String },
    country: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Role", roleSchema);

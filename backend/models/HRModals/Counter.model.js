import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., "employee"
  seq: { type: Number, default: 0 } // last assigned UserId
});

export default mongoose.model("Counter", counterSchema);
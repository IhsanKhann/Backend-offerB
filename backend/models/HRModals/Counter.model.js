// models/FinanceModals/CounterModel.js
// Addresses F-13 — atomic, sequential transactionId generation
import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({
  name : {type: String},
  _id: { type: String },        // e.g. "transactionId"
  seq: { type: Number, default: 0 }
});

const Counter =
  mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

export default Counter;
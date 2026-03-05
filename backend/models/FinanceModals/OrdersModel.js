// models/FinanceModals/OrdersModel.js
// Phase 2 Refactor — Addresses: F-17
//
// Changes from original:
//   F-17 — order_total_amount and unit_price confirmed as integer Number (minor units)
//   F-17 — Added `currency` field at order and item level (PRD §I)
import mongoose from "mongoose";

const { Schema } = mongoose;

const TRANSACTION_TYPES = ["retail", "wholesale", "auction", "service"];
const ORDER_STATUSES    = ["pending", "paid", "shipped", "completed", "cancelled"];

const OrderSchema = new Schema(
  {
    businessSellerId: { type: String, required: true, index: true },
    businessBuyerId:  { type: String, required: true, index: true },

    OrderId:          { type: String, required: true },

    transaction_type: { type: String, enum: TRANSACTION_TYPES, required: true },

    // F-17: integer minor units — e.g. 150000 = PKR 1500.00
    order_total_amount: { type: Number, required: true },

    // F-17 / PRD §I: ISO currency code
    currency: { type: String, required: true, default: "PKR" },

    status: { type: String, enum: ORDER_STATUSES, default: "pending" },

    placed_at: { type: Date, default: Date.now },

    items: [
      {
        product_id: { type: String },
        name:       { type: String },
        quantity:   { type: Number, default: 1 },

        // F-17: integer minor units
        unit_price: { type: Number, required: true },

        // F-17 / PRD §I: per-item currency
        currency:   { type: String, default: "PKR" }
      }
    ]
  },
  {
    timestamps: { createdAt: "placed_at", updatedAt: "updated_at" }
  }
);

const Order = mongoose.model("Order", OrderSchema);

export default Order;
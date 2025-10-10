import mongoose from "mongoose";

const BidderSchema = new mongoose.Schema(
  {
    // The unique ID provided from the frontend or external source
    bidderId: {
      type: String,
      required: true,
      unique: true,
      index: true, // improves query performance
    },

    // Basic identity information
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // // Future fields (reserved for expansion)
    // totalBids: {
    //   type: Number,
    //   default: 0,
    // },

    // totalWon: {
    //   type: Number,
    //   default: 0,
    // },

    // totalSpent: {
    //   type: Number,
    //   default: 0,
    // },

    // lastBidDate: {
    //   type: Date,
    // },

    lastUpdated: {
      type: Date,
      default: Date.now,
    },

    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Bidder", BidderSchema);

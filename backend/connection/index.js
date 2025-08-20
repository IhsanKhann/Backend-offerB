// backend/config/db.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.log("❌ MONGO_URI environment variable is not set");
      return;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.log("❌ MongoDB connection error: ", error.message);
    console.log("💡 Make sure your MongoDB Atlas cluster IP whitelist includes your current IP");
    console.log("💡 Or add 0.0.0.0/0 for development (not recommended for production)");
  }
};

export default connectDB;
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./connection/index.js";

import employeeRouter from "./Routes/employeRoutes.js";
import HierarchyRouter from "./Routes/HiearchyRoutes.js";

dotenv.config();
const app = express();

// Middleware
app.use(cors(
    {
        origin:"http://localhost:5173",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE"],
    }
));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// db connection:
connectDB();

// Routes
app.get("/api/hello", (req, res) => {
  res.status(200).json({
    status:true,
    message:"backend is working..",
  })
});

app.use("/api", employeeRouter);
app.use("/api", HierarchyRouter);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`))
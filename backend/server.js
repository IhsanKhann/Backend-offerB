import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./connection/index.js";

import employeeRouter from "./Routes/employeRoutes.js";
import HierarchyRouter from "./Routes/HiearchyRoutes.js";
import orgUnitsRouter from "./Routes/orgUnitsRoutes.js";
import AuthRouter from "./Routes/authRoutes.js";

dotenv.config();
const app = express();

app.use(cors(
    {
        origin: "http://localhost:5173", // or your React dev server port
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    }
));
app.use(cookieParser());
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
app.use("/api", orgUnitsRouter);
app.use("/api", AuthRouter);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
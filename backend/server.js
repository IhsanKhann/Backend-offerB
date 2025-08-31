import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./connection/index.js";

import { KeepPermissionsUpdated } from "./contollers/permissionControllers.js";
import {checkAndRestoreEmployees} from "./contollers/employeeController.js";

import employeeRouter from "./Routes/employeRoutes.js";
import HierarchyRouter from "./Routes/HiearchyRoutes.js";
import orgUnitsRouter from "./Routes/orgUnitsRoutes.js";
import AuthRouter from "./Routes/authRoutes.js";
import PermissionRouter from "./Routes/permissionRoutes.js";
import FinalizedEmployeesRouter from "./Routes/finalizedEmployeesRoutes.js"


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

// this ensure permissions are loaded to all the top level employees.
await KeepPermissionsUpdated(); 
await checkAndRestoreEmployees();

// Routes
app.get("/api/hello", (req, res) => {
  res.status(200).json({
    status:true,
    message:"backend is working..",
  })
});

app.use("/api/auth", AuthRouter);
app.use("/api/employees", employeeRouter);
app.use("/api/hierarchy", HierarchyRouter);
app.use("/api/orgUnits", orgUnitsRouter);
app.use("/api/permissions", PermissionRouter);
app.use("/api/finalizedEmployees", FinalizedEmployeesRouter);
// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
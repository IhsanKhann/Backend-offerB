import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./connection/index.js";

import { KeepPermissionsUpdated } from "./contollers/permissionControllers.js";
import {checkAndRestoreEmployees} from "./contollers/employeeController.js";

import employeeRouter from "./Routes/employeRoutes.js";
import HierarchyRouter from "./Routes/HiearchyRoutes.js";
import orgUnitRoutes from "./Routes/orgUnitsRoutes.js";
import AuthRouter from "./Routes/authRoutes.js";
import PermissionRouter from "./Routes/permissionRoutes.js";
import FinalizedEmployeesRouter from "./Routes/finalizedEmployeesRoutes.js"
import roleRoutes from "./Routes/RoleRoutes.js";
import LeavesRouter from "./Routes/LeaveRoutes.js";
import branchRouter from "./Routes/branchRoutes.js";
import documentRouter from "./Routes/documentRoutes.js";

// Finance-Routes..
import SummaryRouter from "./Routes/financeRoutes/summaryroutes.js";
import TransactionRouter from "./Routes/financeRoutes/TransactionRoutes.js";
import AccountStatementRouter from "./Routes/financeRoutes/AccountStatementRoutes.js";
import sellerRoutes from "./Routes/financeRoutes/SellerRoutes.js";

// Bussiness operation routes
import CycleRouter from "./Routes/BussinessOperationRoutes/cyclesRoutes.js";
import ExpenseRouter from "./Routes/BussinessOperationRoutes/ExpenseRoutes.js";
import CronRouter from "./middlewares/cronMiddleware.js";
import CommissionReports from "./Routes/BussinessOperationRoutes/ComissionReportsRoutes.js";

// Cron-Jobs: for the events..
// import "../backend/events/eventsCronJobs.js";

// Notifications:
import notificationRouter from "./Routes/NotificationRoutes.js";
import debugRoutes from "./Routes/debug.routes.js";

import { apiLimiter } from "./middlewares/rateLimiter.js";

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

dotenv.config({ path: envFile });
const app = express();
app.use("/api", apiLimiter);

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

app.use("/api/debug", debugRoutes);

app.use((req, res, next) => {
  console.log("🌐 Incoming request:", req.method, req.originalUrl);
  next();
});

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
app.use('/api/org-units', orgUnitRoutes);
app.use("/api/permissions", PermissionRouter);
app.use("/api/finalizedEmployees", FinalizedEmployeesRouter);
app.use("/api/roles", roleRoutes);
app.use("/api/branches", branchRouter);
// changed /api/allRoles..
app.use("/api/documents", documentRouter);

app.use("/api/leaves", LeavesRouter);

// finance routes:
app.use("/api/summaries", SummaryRouter);
app.use("/api/transactions", TransactionRouter);
app.use("/api/statements", AccountStatementRouter);
app.use("/api/sellers", sellerRoutes);

// bussiness operation routes can be added here..
app.use("/api/cycles", CycleRouter)
// app.use("/api/cron", CronRouter);
app.use("/api/expenseReports", ExpenseRouter);
app.use("/api/commissionReports", CommissionReports);

app.use("/api", notificationRouter);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
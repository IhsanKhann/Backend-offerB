import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Provider } from "react-redux";
import store from "./store/store.jsx";
import "./index.css";

// Components
import ProtectedRoute from "./components/ProtectedRoutes.jsx";
import HomePage from "./Pages/HomePage.jsx";
import LoginPage from "./Pages/loginPage.jsx";
import { ResetPasswordPage, ForgetUserId } from "./components/ResetLoginPage.jsx";
import NotificationManager from "./components/NotificationManager.jsx";
import HierarchyTree from "./components/HieararchyTree.jsx";

// HR / Administration Pages
import EmployeeRegistrationForm from "./Forms/EmployeeRegistration.jsx";
import AssignRolesForm from "./Forms/AssignRolesForm.jsx";
import AdminDashboard from "./Pages/AdminDashboard.jsx";
import DraftDashboard from "./Pages/DraftsDashboard.jsx";
import PermissionHandler from "./Pages/PermissionsHandler.jsx";
import LeaveApplications from "./Pages/LeaveApplications.jsx";
import RoleManager from "./components/RolesManagerAdvanced.jsx";
import EmployeesPermissions  from "./components/PermissionsManager.jsx";

// Finance Pages
import SummaryTable from "./Pages/Finance/SummaryTable.jsx";
import RuleTable from "./Pages/Finance/Table.jsx";
import SalaryDashboard from "./Pages/Finance/SalaryDashboard.jsx";
import BreakupSummary from "./Pages/Finance/BreakupSummary.jsx";
import SalaryRulesTable from "./Pages/Finance/SalaryRules.jsx";
import TransactionTestPage from "./Pages/Finance/Testing.jsx";
import SellerDashboard from "./Pages/Finance/SellerDashboard.jsx";
import BuyerBreakupSummary from "./Pages/Finance/BuyerBreakup.jsx";
import BusinessTables from "./Pages/Finance/BussinessTable.jsx";
import SalaryHistoryPage from "./Pages/Finance/SalariesHistoryPage.jsx";
import Sellers from "./Pages/Finance/Sellers.jsx";
import AccountStatements from "./Pages/Finance/AccountStatements.jsx";
import PaidStatements from "./Pages/Finance/AccountStatementsPaid.jsx";
import BidderDashboard from "./Pages/Finance/BidderDashboard.jsx";

// Business Operation Pages
import ExpenseDashboard from "./Pages/BussinessOperation/ExpenseDashboard.jsx";
import CalculatedExpenseReports from "./Pages/BussinessOperation/ExpenseReports-calculated.jsx";
import PaidExpenseReports from "./Pages/BussinessOperation/ExpenseReports-paid.jsx";
import PaidExpenses from "./Pages/BussinessOperation/ExpenseTransactions-Paid.jsx";
import UnpaidExpenses from "./Pages/BussinessOperation/ExpenseTransactions-Unpaid.jsx";
import CommissionDashboard from "./Pages/BussinessOperation/CommissionDashboard.jsx";
import CommissionReports from "./Pages/BussinessOperation/CommissionReportsPage.jsx";
import CommissionTransactions from "./Pages/BussinessOperation/CommissionTransactions.jsx";

// Other Pages
import ProfilePage from "./Pages/EmployeeProfile.jsx";
import { all } from "axios";

const router = createBrowserRouter([
  // ==========================================
  // PUBLIC & SHARED ROUTES
  // ==========================================
  { path: "/login", element: <LoginPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/forget-UserId", element: <ForgetUserId /> },
  {
    path: "/",
    element: <ProtectedRoute><HomePage /></ProtectedRoute>,
  },
  {
    path: "/profile",
    element: <ProtectedRoute><ProfilePage /></ProtectedRoute>,
    children: [
      { path: "about", element: <ProfilePage section="about" /> },
      { path: "allowance", element: <ProfilePage section="allowance" /> },
      { path: "leave", element: <ProfilePage section="leave" /> },
      { path: "retirement", element: <ProfilePage section="retirement" /> },
      { path: "loan", element: <ProfilePage section="loan" /> },
      { path: "", element: <ProfilePage section="about" /> },
    ],
  },

  // ==========================================
  // HR & ADMINISTRATION (DECIDED)
  // ==========================================
  {
    path: "/register-employee",
    element: <ProtectedRoute allowedDepartments={["HR", "All"]}><EmployeeRegistrationForm /></ProtectedRoute>,
  },
  {
    path: "/assign-roles/:employeeId",
    element: <ProtectedRoute allowedDepartments={["HR", "All"]}><AssignRolesForm /></ProtectedRoute>,
  },
  {
    path: "/assign-roles",
    element: <ProtectedRoute allowedDepartments={["HR", "All"]}><AssignRolesForm /></ProtectedRoute>,
  },
  {
    path: "/DraftDashboard",
    element: <ProtectedRoute allowedDepartments={["HR", "All"]}><DraftDashboard /></ProtectedRoute>,
  },
  {
    path: "/admin/dashboard",
    element: <ProtectedRoute allowedDepartments={["HR", "All"]}><AdminDashboard /></ProtectedRoute>,
  },
  {
    path: "/Permission-handler",
    element: <ProtectedRoute allowedDepartments={["HR", "All"]}><PermissionHandler /></ProtectedRoute>,
  },
  {
    path: "/notification-manager",
    element: <ProtectedRoute allowedDepartments={["HR", "All"]}><NotificationManager /></ProtectedRoute>,
  },
  {
    path: "/leave-applications",
    element: <ProtectedRoute allowedDepartments={["HR", "All"]}><LeaveApplications /></ProtectedRoute>,
  },

  // ==========================================
  // FINANCE (DECIDED)
  // ==========================================
  {
    path: "/salary-dashboard",
    element: <ProtectedRoute allowedDepartments={["Finance", "All"]}><SalaryDashboard /></ProtectedRoute>,
  },
  {
    path: "/accountStatements",
    element: <ProtectedRoute allowedDepartments={["Finance", "All"]}><AccountStatements /></ProtectedRoute>,
  },
  {
    path: "/accountStatements/paid",
    element: <ProtectedRoute allowedDepartments={["Finance", "All"]}><PaidStatements /></ProtectedRoute>,
  },
  {
    path: "/sellerDashboard",
    element: <ProtectedRoute allowedDepartments={["Finance", "All"]}><SellerDashboard /></ProtectedRoute>,
  },
  {
    path: "/bidderDashboard",
    element: <ProtectedRoute allowedDepartments={["Finance", "All"]}><BidderDashboard /></ProtectedRoute>,
  },
  {
    path: "/BussinessBreakupTables",
    element: <ProtectedRoute allowedDepartments={["Finance", "All"]}><BusinessTables /></ProtectedRoute>,
  },
  {
    path: "/salary/history/:employeeId",
    element: <ProtectedRoute allowedDepartments={["Finance", "All"]}><SalaryHistoryPage /></ProtectedRoute>,
  },
  {
    path: "/summary-table",
    element: <ProtectedRoute allowedDepartments={["Finance", "All"]}><SummaryTable /></ProtectedRoute>,
  },
  {
    path: "/tables",
    element: <ProtectedRoute allowedDepartments={["Finance", "All"]}><RuleTable /></ProtectedRoute>,
  },
  {
    path: "/salary/breakup/:employeeId?",
    element: <ProtectedRoute allowedDepartments={["Finance", "All"]}><BreakupSummary /></ProtectedRoute>,
  },

  // ==========================================
  // BUSINESS OPERATIONS (DECIDED)
  // ==========================================
  {
    path: "/expenseDashboard",
    element: <ProtectedRoute allowedDepartments={["BusinessOperation", "All"]}><ExpenseDashboard /></ProtectedRoute>,
  },
  {
    path: "/expenseDashboard/CalculatedExpenseReports",
    element: <ProtectedRoute allowedDepartments={["BusinessOperation", "All"]}><CalculatedExpenseReports /></ProtectedRoute>,
  },
  {
    path: "/expenseDashboard/PaidExpenseReports",
    element: <ProtectedRoute allowedDepartments={["BusinessOperation", "All"]}><PaidExpenseReports /></ProtectedRoute>,
  },
  {
    path: "/expenseDashboard/PaidExpenses",
    element: <ProtectedRoute allowedDepartments={["BusinessOperation", "All"]}><PaidExpenses /></ProtectedRoute>,
  },
  {
    path: "/expenseDashboard/UnPaidExpenses",
    element: <ProtectedRoute allowedDepartments={["BusinessOperation", "All"]}><UnpaidExpenses /></ProtectedRoute>,
  },
  {
    path: "/commissionDashboard",
    element: <ProtectedRoute allowedDepartments={["BusinessOperation", "All"]}><CommissionDashboard /></ProtectedRoute>,
  },
  {
    path: "/commissionDashboard/Reports",
    element: <ProtectedRoute allowedDepartments={["BusinessOperation", "All"]}><CommissionReports /></ProtectedRoute>,
  },
  {
    path: "/commissionDashboard/Transactions",
    element: <ProtectedRoute allowedDepartments={["BusinessOperation", "All"]}><CommissionTransactions /></ProtectedRoute>,
  },

  // ==========================================
  // PENDING / TO BE DECIDED (UNMARKED)
  // ==========================================
  {
    path: "/employees-permissions",
    element: <ProtectedRoute allowedDepartments={["HR", "All" ]}>
        <EmployeesPermissions />
      </ProtectedRoute>,
  },
  {
    path: "/salary/rulesTable",
    element: <ProtectedRoute allowedDepartments={["Finance", "All" ]}>
        <SalaryRulesTable />
      </ProtectedRoute>,
  },
  {
    path: "/paymentDashboard",
    element: <ProtectedRoute><TransactionTestPage /></ProtectedRoute>,
  },
  {
    path: "/buyer-breakup/:buyerId",
    element: <ProtectedRoute><BuyerBreakupSummary /></ProtectedRoute>,
  },
  {
    path: "/sellers",
    element: <ProtectedRoute  allowedDepartments={["Finance", "All" ]}> 
      <Sellers />
    </ProtectedRoute>,
  },
  {
    path: "/RolesManagerAdvanced",
    element: <ProtectedRoute  allowedDepartments={["Finance", "HR" ]}>
        <RoleManager /> 
      </ProtectedRoute>,
  },
   {
    path: "/organization",
    element: <ProtectedRoute  allowedDepartments={["Finance", "HR" ]}>
        <HierarchyTree />
      </ProtectedRoute>,
  },
  
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <RouterProvider router={router} />
  </Provider>
);
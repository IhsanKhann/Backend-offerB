import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import HomePage from "./Pages/HomePage.jsx";
import EmployeeRegistrationForm from "./Forms/EmployeeRegistration.jsx";
import AssignRolesForm from "./Forms/AssignRolesForm.jsx";
import AdminDashboard from "./Pages/AdminDashboard.jsx";
import LoginPage from "./Pages/loginPage.jsx";
import ProtectedRoute from "./components/ProtectedRoutes.jsx";
import DraftDashboard from "./Pages/DraftsDashboard.jsx";
import PermissionHandler from "./Pages/PermissionsHandler.jsx";
import ProfilePage from "./Pages/EmployeeProfile.jsx";
import { EmployeesPermissions } from "./components/PermissionsManager.jsx";
import { ResetPasswordPage, ForgetUserId } from "./components/ResetLoginPage.jsx";
import LeaveApplications from "./Pages/LeaveApplications.jsx";

import NotificationManager from "./components/NotificationManager.jsx";

// finance:
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
// Account Statements:
import AccountStatements from "./Pages/Finance/AccountStatements.jsx";
import PaidStatements from "./Pages/Finance/AccountStatementsPaid.jsx";
import BidderDashboard from "./Pages/Finance/BidderDashboard.jsx";

import CalculatedExpenseReports from "./Pages/BussinessOperation/ExpenseReports-calculated.jsx";
import PaidExpenseReports from "./Pages/BussinessOperation/ExpenseReports-paid.jsx";
import PaidExpenses from "./Pages/BussinessOperation/ExpenseTransactions-Paid.jsx";
import UnpaidExpenses from "./Pages/BussinessOperation/ExpenseTransactions-Unpaid.jsx"

import CommissionDashboard from "./Pages/BussinessOperation/CommissionDashboard.jsx";
import CommissionReports from "./Pages/BussinessOperation/CommissionReportsPage.jsx";
import CommissionTransactions from "./Pages/BussinessOperation/CommissionTransactions.jsx";

import "./index.css";
import store from "./store/store.jsx";
import { Provider } from "react-redux";

import ExpenseDashboard from "./Pages/BussinessOperation/ExpenseDashboard.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <HomePage />
      </ProtectedRoute>
    ),
  },
  { path: "/login", element: <LoginPage /> },
  {
    path: "/register-employee",
    element: (
      <ProtectedRoute>
        <EmployeeRegistrationForm />
      </ProtectedRoute>
    ),
  },
  {
    path: "/assign-roles/:employeeId",
    element: (
      <ProtectedRoute>
        <AssignRolesForm />
      </ProtectedRoute>
    ),
  },
  {
    path: "/assign-roles",
    element: (
      <ProtectedRoute>
        <AssignRolesForm />
      </ProtectedRoute>
    ),
  },
  {
    path: "/DraftDashboard",
    element: (
      <ProtectedRoute>
        <DraftDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/dashboard",
    element: (
      <ProtectedRoute>
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/forget-UserId", element: <ForgetUserId /> },
  {
    path: "/Permission-handler",
    element: (
      <ProtectedRoute>
        <PermissionHandler />
      </ProtectedRoute>
    ),
  },
  {
    path: "/employees-permissions",
    element: (
      <ProtectedRoute>
        <EmployeesPermissions />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
    children: [
      { path: "about", element: <ProfilePage section="about" /> },
      { path: "allowance", element: <ProfilePage section="allowance" /> },
      { path: "leave", element: <ProfilePage section="leave" /> },
      { path: "retirement", element: <ProfilePage section="retirement" /> },
      { path: "loan", element: <ProfilePage section="loan" /> },
      { path: "", element: <ProfilePage section="about" /> }, // default
    ],
  },
  {
    path: "/leave-applications",
    element: (
      <ProtectedRoute>
        <LeaveApplications />
      </ProtectedRoute>
    ),
  },
  {
    path: "/summary-table",
    element: (
      <ProtectedRoute>
        <SummaryTable />
      </ProtectedRoute>
    ),
  },
  {
    path: "/tables",
    element: (
      <ProtectedRoute>
        <RuleTable />
      </ProtectedRoute>
    ),
  },
  {
    path: "/salary-dashboard",
    element: (
      <ProtectedRoute>
        <SalaryDashboard />
      </ProtectedRoute>
    ),
  },
  {
   path: "/salary/breakup/:employeeId",
   element: (
     <ProtectedRoute>
       <BreakupSummary />
     </ProtectedRoute> 
   ),
  },
  {
   path: "/salary/breakup",
   element: (
     <ProtectedRoute>
       <BreakupSummary />
     </ProtectedRoute> 
   ),
  },
  {
   path: "/salary/rulesTable",
   element: (
     <ProtectedRoute>
       <SalaryRulesTable />
     </ProtectedRoute> 
   ),
  },
  {
   path: "/paymentDashboard",
   element: (
     <ProtectedRoute>
       <TransactionTestPage />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/sellerDashboard",
   element: (
     <ProtectedRoute>
       <SellerDashboard />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/buyer-breakup/:buyerId",
   element: (
     <ProtectedRoute>
       <BuyerBreakupSummary />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/BussinessBreakupTables",
   element: (
     <ProtectedRoute>
       <BusinessTables />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/accountStatements",
   element: (
     <ProtectedRoute>
       <AccountStatements />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/accountStatements/paid",
   element: (
     <ProtectedRoute>
       <PaidStatements />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/sellers",
   element: (
     <ProtectedRoute>
       <Sellers />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/bidderDashboard",
   element: (
     <ProtectedRoute>
       <BidderDashboard />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/salary/history/:employeeId",
   element: (
     <ProtectedRoute>
        <SalaryHistoryPage />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/expenseDashboard",
   element: (
     <ProtectedRoute>
        <ExpenseDashboard />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/expenseDashboard/CalculatedExpenseReports",
   element: (
     <ProtectedRoute>
        <CalculatedExpenseReports />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/expenseDashboard/PaidExpenseReports",
   element: (
     <ProtectedRoute>
        <PaidExpenseReports />
     </ProtectedRoute> 
   ),
  },
  {
   path: "/expenseDashboard/PaidExpenses",
   element: (
     <ProtectedRoute>
        <PaidExpenses />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/expenseDashboard/UnPaidExpenses",
   element: (
     <ProtectedRoute>
        <UnpaidExpenses />
     </ProtectedRoute> 
   ),
  },
       {
   path: "/commissionDashboard",
   element: (
     <ProtectedRoute>
        <CommissionDashboard />
     </ProtectedRoute> 
   ),
  },
     {
   path: "/commissionDashboard/Reports",
   element: (
     <ProtectedRoute>
        <CommissionReports />
     </ProtectedRoute> 
   ),
  },
     {
   path: "/commissionDashboard/Transactions",
   element: (
     <ProtectedRoute>
        <CommissionTransactions />
     </ProtectedRoute> 
   ),
  },
   {
   path: "/notification-manager",
   element: (
     <ProtectedRoute>
        <NotificationManager />
     </ProtectedRoute> 
   ),
  },
    
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <RouterProvider router={router} />
  </Provider>
);

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

// finance:
import SummaryTable from "./Pages/Finance/SummaryTable.jsx";
import RuleTable from "./Pages/Finance/Table.jsx";
import SalaryDashboard from "./Pages/Finance/SalaryDashboard.jsx";
import BreakupSummary from "./Pages/Finance/BreakupSummary.jsx";
import SalaryRulesTable from "./Pages/Finance/SalaryRules.jsx";
import TransactionTestPage from "./Pages/Finance/Testing.jsx";

import "./index.css";
import store from "./store/store.jsx";
import { Provider } from "react-redux";

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
  
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <RouterProvider router={router} />
  </Provider>
);

// index.jsx
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
import {ResetPasswordPage,ForgetUserId} from "./components/ResetLoginPage.jsx";

import "./index.css";

// store:
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
  {
    path: "/login",
    element: <LoginPage />,
  },
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
  {
    path: "/reset-password",
    element: (
        <ResetPasswordPage/>
    )
  },
  {
    path: "/forget-UserId",
    element: (
        <ForgetUserId/>
    )
  },
    {
    path: "/Permission-handler",
    element: (
        <PermissionHandler/>
    )
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <RouterProvider router={router} />
  </Provider>
);

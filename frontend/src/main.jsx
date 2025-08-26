import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import HomePage from "./Pages/HomePage.jsx";
import EmployeeRegistrationForm from "./Forms/EmployeeRegistration.jsx";
import AssignRolesForm from "./Forms/AssignRolesForm.jsx";
import AdminDashboard from "./Pages/AdminDashboard.jsx";
import LoginPage from "./Pages/loginPage.jsx";

import "./index.css";

// store:
import store from "./store/store.jsx";
import {Provider} from "react-redux";

// drafts:
import DraftDashboard from "./Pages/DraftsDashboard.jsx";

// Routes:
const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/register-employee",
    element: <EmployeeRegistrationForm />,
  },
  {
    path: "/assign-roles/:employeeId",
    element: <AssignRolesForm />,
  },
  {
    path: "/assign-roles",
    element: <AssignRolesForm />,
  },
  {
    path: "/DraftDashboard",
    element: <DraftDashboard/>
  },
  {
    path: "/admin/dashboard",
    element: <AdminDashboard />
  },
  
]);

ReactDOM.createRoot(document.getElementById("root")).render(
    <Provider store={store}> 
       <RouterProvider router={router} /> 
    </Provider>   
);

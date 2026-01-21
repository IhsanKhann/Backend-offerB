import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const HomePage = () => {
  const navigate = useNavigate();
  const [userAssignment, setUserAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserAssignment = async () => {
      try {
        const employeeId = localStorage.getItem("employeeId");
        
        if (!employeeId) {
          navigate("/login");
          return;
        }

        const response = await api.get(`/roles/assignment/${employeeId}`);
        
        if (response.data.success) {
          setUserAssignment(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching user assignment:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAssignment();
  }, [navigate]);

  const getDashboards = () => {
    if (!userAssignment) return [];

    const allDashboards = [
      {
        name: "HR Dashboard",
        code: "HR",
        path: "/hr-dashboard",
        icon: "👥",
        description: "Manage employees, recruitment, and HR operations"
      },
      {
        name: "Finance Dashboard",
        code: "Finance",
        path: "/finance-dashboard",
        icon: "💰",
        description: "Financial reporting, budgets, and transactions"
      },
      {
        name: "Business Operations Dashboard",
        code: "BusinessOperation",
        path: "/business-operations-dashboard",
        icon: "📊",
        description: "Operations management and business analytics"
      }
    ];

    if (userAssignment.departmentCode === "All") {
      return allDashboards;
    }

    return allDashboards.filter(
      dashboard => dashboard.code === userAssignment.departmentCode
    );
  };

  const getStatusDisplay = () => {
    if (!userAssignment) return "";
    
    if (userAssignment.status === "All") {
      return "Executive Level - Full Access";
    }
    
    return userAssignment.status;
  };

  const getAccessLevel = () => {
    if (!userAssignment) return "";

    const isExecutive = userAssignment.departmentCode === "All" || 
                        userAssignment.status === "All";
    
    if (isExecutive) {
      if (userAssignment.departmentCode === "All" && userAssignment.status === "All") {
        return "Top-Level Executive (Unrestricted Access)";
      } else if (userAssignment.departmentCode === "All") {
        return "Cross-Department Executive";
      } else if (userAssignment.status === "All") {
        return "Department-Wide Executive";
      }
    }

    return `${userAssignment.departmentCode} - ${userAssignment.status}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Loading your dashboard...</div>
      </div>
    );
  }

  if (!userAssignment) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl text-red-600">
          No role assignment found. Please contact HR.
        </div>
      </div>
    );
  }

  const dashboards = getDashboards();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome to Your Dashboard
          </h1>
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Role:</span>
              <span className="text-gray-600">
                {userAssignment.roleId?.roleName || "N/A"}
              </span>
              {(userAssignment.departmentCode === "All" || 
                userAssignment.status === "All") && (
                <span className="ml-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                  EXECUTIVE
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Access Level:</span>
              <span className="text-gray-600">{getAccessLevel()}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Department:</span>
              <span className="text-gray-600">
                {userAssignment.departmentCode === "All" 
                  ? "All Departments" 
                  : userAssignment.departmentCode}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Status:</span>
              <span className="text-gray-600">{getStatusDisplay()}</span>
            </div>

            {userAssignment.orgUnit && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Location:</span>
                <span className="text-gray-600">
                  {userAssignment.orgUnit.name}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Your Dashboards
            {userAssignment.departmentCode === "All" && (
              <span className="ml-3 text-sm font-normal text-gray-600">
                (All departments accessible)
              </span>
            )}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboards.map((dashboard) => (
            <div
              key={dashboard.code}
              onClick={() => navigate(dashboard.path)}
              className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200 border-2 border-transparent hover:border-blue-500"
            >
              <div className="text-4xl mb-4">{dashboard.icon}</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {dashboard.name}
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                {dashboard.description}
              </p>
              <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Open Dashboard
              </button>
            </div>
          ))}
        </div>

        {dashboards.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800">
              No dashboards available for your current assignment.
              Please contact your administrator.
            </p>
          </div>
        )}

        {userAssignment.departmentCode === "All" && (
          <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-purple-900 mb-2">
              🎯 Executive Access Enabled
            </h3>
            <p className="text-purple-800">
              You have unrestricted access to all department dashboards and can view 
              all organizational data without filtering restrictions.
            </p>
          </div>
        )}

        {userAssignment.status === "All" && userAssignment.departmentCode !== "All" && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-blue-900 mb-2">
              🏢 Department-Wide Access
            </h3>
            <p className="text-blue-800">
              You have full access to all levels within the {userAssignment.departmentCode} department.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
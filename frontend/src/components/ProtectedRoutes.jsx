import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { FiLock, FiArrowLeft, FiAlertOctagon } from "react-icons/fi";
import api from "../api/axios";

const ProtectedRoute = ({ children, allowedDepartments = [] }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [userDepartment, setUserDepartment] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const verifyUser = async () => {
      try {
        console.log("🔐 ProtectedRoute: Verifying user...");
        const res = await api.get("/auth/check-auth");
        
        console.log("📦 Check-auth response:", res.data);
        
        // ✅ FIXED: Backend returns "success", not "status"
        if (res.data.success) {
          console.log("✅ Authentication successful");
          setAuthenticated(true);
          
          // ✅ Get department from user object
          const department = res.data.user.department;
          setUserDepartment(department);
          
          console.log("✅ User department:", department);
          console.log("✅ User data:", res.data.user);
        } else {
          console.log("❌ Authentication failed - success is false");
          setAuthenticated(false);
        }
      } catch (err) {
        console.error("❌ Auth verification failed:", err);
        console.error("❌ Error response:", err.response?.data);
        console.error("❌ Error status:", err.response?.status);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-blue-200 rounded-full mb-4"></div>
          <p className="text-gray-500 font-medium">Verifying Credentials...</p>
        </div>
      </div>
    );
  }

  // 2. Not Authenticated: Send to Login
  if (!isAuthenticated) {
    console.log("🔒 Not authenticated - redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // 3. ✅ Check department access
  const hasAccess = 
    allowedDepartments.length === 0 ||           // No restrictions (public route)
    userDepartment === "All" ||                   // Executive access (bypass all checks)
    allowedDepartments.includes(userDepartment); // Department match

  console.log("🔍 Access check:", {
    userDepartment,
    allowedDepartments,
    hasAccess
  });

  if (!hasAccess) {
    console.log("🚫 Access denied");
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white shadow-2xl rounded-2xl overflow-hidden border border-gray-100">
          <div className="bg-red-600 p-6 flex justify-center">
            <FiAlertOctagon size={64} className="text-white opacity-90" />
          </div>
          
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Restricted</h2>
            <p className="text-gray-600 mb-6">
              Your account currently belongs to the <span className="font-bold text-blue-600">{userDepartment}</span> department. 
              This section is restricted to <span className="font-medium text-gray-800">{allowedDepartments.join(" or ")}</span> personnel only.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => navigate("/")}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-all"
              >
                <FiArrowLeft /> Return to Dashboard
              </button>
              
              <p className="text-xs text-gray-400 mt-4 italic">
                Ref ID: {userDepartment?.substring(0,2)}-{Math.floor(Math.random() * 1000)} | Secure Access Layer
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. All checks passed: Render the page
  console.log("✅ Access granted - rendering protected content");
  return children;
};

export default ProtectedRoute;
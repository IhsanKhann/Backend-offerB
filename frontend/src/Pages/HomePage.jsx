import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiLogOut, FiUser, FiBriefcase, FiDollarSign, FiTrendingUp } from "react-icons/fi";
import api from "../api/axios.js";

function HomePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeDashboard, setActiveDashboard] = useState("HR");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        console.log("📡 Fetching user profile...");
        const res = await api.get("/auth/me");
        const userData = res.data.user;
        console.log("✅ User loaded:", userData);
        console.log("✅ Department:", userData.department);
        console.log("✅ Accessible Departments:", userData.accessibleDepartments);
        
        setProfile(userData);

        // Set initial dashboard based on accessible departments
        if (userData.accessibleDepartments && userData.accessibleDepartments.length > 0) {
          setActiveDashboard(userData.accessibleDepartments[0]);
        } else if (userData.department) {
          setActiveDashboard(userData.department);
        }

        setLoading(false);
      } catch (err) {
        console.error("❌ Error fetching profile:", err);
        console.error("❌ Response:", err.response?.data);
        
        // ✅ FIXED: Redirect to login on 401
        if (err.response?.status === 401) {
          console.log("🔒 Unauthorized - redirecting to login");
          localStorage.removeItem("accessToken");
          navigate("/login");
        } else {
          setLoading(false);
        }
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      console.log("🚪 Logging out...");
      await api.post("/auth/logout");
      console.log("✅ Logout successful");
    } catch (err) {
      console.error("❌ Logout error:", err);
    } finally {
      localStorage.removeItem("accessToken");
      navigate("/login");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // ✅ FIXED: If profile failed to load and we didn't redirect, show error
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Unable to Load Profile</h2>
          <p className="text-gray-600 mb-4">There was an error loading your profile.</p>
          <button
            onClick={() => navigate("/login")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // Dashboard configurations
  const dashboards = {
    HR: {
      title: "HR & Administration",
      icon: <FiBriefcase size={32} />,
      gradient: "from-indigo-500 to-indigo-600",
      cards: [
        { title: "Employee Registration", desc: "Register new employees", path: "/register-employee" },
        { title: "Draft Dashboard", desc: "Manage employee drafts", path: "/DraftDashboard" },
        { title: "Admin Dashboard", desc: "Access admin reports", path: "/admin/dashboard" },
        { title: "Assign Roles", desc: "Assign roles to employees", path: "/assign-roles" },
        { title: "Permissions Management", desc: "Manage system permissions", path: "/Permission-handler" },
        { title: "Notification Manager", desc: "Manage notification rules", path: "/notification-manager" },
        { title: "Leave Applications", desc: "Review leave requests", path: "/leave-applications" },
        { title: "Employee Permissions", desc: "Permissions for Employees", path: "/employees-permissions" },    
        { title: "Roles Manager Advanced", desc: "Grouping of the roles and the assignments", path: "/RolesManagerAdvanced" },
        { title: "Organization Hierarchy", desc: "The organization Hierarchy with all nodes", path: "/organization" },
      ]
    },
    Finance: {
      title: "Finance & Accounting",
      icon: <FiDollarSign size={32} />,
      gradient: "from-blue-500 to-blue-600",
      cards: [
        { title: "Salary Dashboard", desc: "View/manage employee salaries", path: "/salary-dashboard" },
        { title: "Salaries Rules", desc: "Rules for salaries with base salary, allowences and deductions ", path: "/salary/rulesTable" },  
        { title: "Salary History", desc: "View salary history", path: "/salary/history" }, 
        
        { title: "Sellers Dashboard", desc: "Manage all sellers", path: "/sellerDashboard" },
        { title: "Sellers", desc: "Sellers and Actions for them", path: "/sellers" },

        { title: "Account Statements", desc: "Track statements and payments", path: "/accountStatements" },
        { title: "Paid Statements", desc: "View paid account statements", path: "/accountStatements/paid" },
        { title: "Business Tables", desc: "View business breakup tables", path: "/BussinessBreakupTables" },
       
        { title: "Summary Table", desc: "View salary summary tables", path: "/summary-table" },
        { title: "Rule Table", desc: "View salary rules", path: "/tables" },
        { title: "Breakup Summary", desc: "View salary breakup", path: "/salary/breakup" },
      ]
    },
    BusinessOperation: {
      title: "Business Operations",
      icon: <FiTrendingUp size={32} />,
      gradient: "from-purple-500 to-purple-600",
      cards: [
        { title: "Expense Dashboard", desc: "Manage all expenses", path: "/expenseDashboard" },
        { title: "Calculated Expense Reports", desc: "View calculated expense reports", path: "/expenseDashboard/CalculatedExpenseReports" },
        { title: "Paid Expense Reports", desc: "View paid expense reports", path: "/expenseDashboard/PaidExpenseReports" },
        { title: "Paid Expenses", desc: "Manage paid expenses", path: "/expenseDashboard/PaidExpenses" },
        { title: "Unpaid Expenses", desc: "Manage unpaid expenses", path: "/expenseDashboard/UnPaidExpenses" },
        { title: "Commission Dashboard", desc: "View commission stats", path: "/commissionDashboard" },
        { title: "Commission Reports", desc: "View commission reports", path: "/commissionDashboard/Reports" },
        { title: "Commission Transactions", desc: "Manage commission transactions", path: "/commissionDashboard/Transactions" },
      ]
    }
  };

  // Determine accessible dashboards
  const accessibleDashboards = profile?.department === "All" 
    ? ["HR", "Finance", "BusinessOperation"]
    : profile?.accessibleDepartments || [profile?.department || "HR"];

  const canSwitchDashboards = accessibleDashboards.length > 1;
  const currentDashboard = dashboards[activeDashboard] || dashboards.HR;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Top Header with Profile */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">OfferBerries</h1>
            <p className="text-gray-600 text-lg mt-2">
              Welcome back, {profile?.individualName}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Profile Section */}
            {profile && (
              <div
                className="flex items-center gap-2 cursor-pointer bg-white shadow-lg rounded-xl p-3 hover:shadow-xl transition-shadow"
                onClick={() => navigate("/profile")}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 flex items-center justify-center">
                  <FiUser size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{profile.individualName}</p>
                  <p className="text-xs text-gray-500">{profile.role?.roleName || "Employee"}</p>
                </div>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg transition duration-200"
            >
              <FiLogOut className="mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Selector - Only shown if user has access to multiple dashboards */}
      {canSwitchDashboards && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Dashboard</h2>
            <div className="flex gap-4 flex-wrap">
              {accessibleDashboards.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setActiveDashboard(dept)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                    activeDashboard === dept
                      ? `bg-gradient-to-r ${dashboards[dept].gradient} text-white shadow-lg`
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {dashboards[dept].icon}
                  <span>{dashboards[dept].title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Dashboard Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          {currentDashboard.icon}
          <h2 className="text-3xl font-bold text-gray-800">{currentDashboard.title}</h2>
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {currentDashboard.cards.map((card, idx) => (
            <div
              key={idx}
              onClick={() => navigate(card.path)}
              className={`cursor-pointer bg-gradient-to-r ${currentDashboard.gradient} text-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between transform hover:-translate-y-1`}
            >
              <div>
                <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
                <p className="text-sm opacity-90">{card.desc}</p>
              </div>
              <div className="mt-4 text-sm font-medium opacity-90">→ Click to open</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="bg-white rounded-xl shadow-md p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${currentDashboard.gradient}`}></div>
            <span className="text-sm font-medium text-gray-600">
              Current View: <span className="font-bold text-gray-900">{currentDashboard.title}</span>
            </span>
            {profile?.department === "All" && (
              <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full font-medium">
                Full Access (All Departments)
              </span>
            )}
          </div>
          {canSwitchDashboards && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">
              Executive Access
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
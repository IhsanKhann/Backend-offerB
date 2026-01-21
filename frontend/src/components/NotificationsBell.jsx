import { useEffect, useState } from "react";
import {
  FiLogOut,
  FiUser,
  FiBriefcase,
  FiDollarSign,
  FiTrendingUp,
} from "react-icons/fi";
import api from "../api/axios.js";

function HomePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const navigate = (path) => {
    window.location.href = path;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/auth/me");
        setProfile(res.data.user);
      } catch (err) {
        console.error("Profile fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin h-12 w-12 border-b-2 border-indigo-600 rounded-full" />
      </div>
    );
  }

  // ================= DASHBOARD CONFIG (MERGED) =================
  const dashboards = {
    HR: {
      title: "HR & Administration",
      icon: <FiBriefcase size={28} />,
      gradient: "from-indigo-500 to-indigo-600",
      cards: [
        { title: "My Profile", path: "/profile", icon: <FiUser /> },
        { title: "Employee Registration", path: "/register-employee" },
        { title: "Draft Dashboard", path: "/DraftDashboard" },
        { title: "Admin Dashboard", path: "/admin/dashboard" },
        { title: "Assign Roles", path: "/assign-roles" },
        { title: "Permissions Management", path: "/Permission-handler" },
        { title: "Notification Manager", path: "/notification-manager" },
        { title: "Leave Applications", path: "/leave-applications" },
      ],
    },

    Finance: {
      title: "Finance & Accounting",
      icon: <FiDollarSign size={28} />,
      gradient: "from-blue-500 to-blue-600",
      cards: [
        { title: "My Profile", path: "/profile", icon: <FiUser /> },
        { title: "Salary Dashboard", path: "/salary-dashboard" },
        { title: "Salary History", path: "/salary/history" },
        { title: "Account Statements", path: "/accountStatements" },
        { title: "Paid Statements", path: "/accountStatements/paid" },
        { title: "Sellers Dashboard", path: "/sellerDashboard" },
        { title: "Bidder Dashboard", path: "/bidderDashboard" },
        { title: "Business Tables", path: "/BussinessBreakupTables" },
        { title: "Summary Table", path: "/summary-table" },
        { title: "Rule Table", path: "/tables" },
        { title: "Breakup Summary", path: "/salary/breakup" },
      ],
    },

    BusinessOperation: {
      title: "Business Operations",
      icon: <FiTrendingUp size={28} />,
      gradient: "from-purple-500 to-purple-600",
      cards: [
        { title: "My Profile", path: "/profile", icon: <FiUser /> },
        { title: "Expense Dashboard", path: "/expenseDashboard" },
        { title: "Calculated Expense Reports", path: "/expenseDashboard/CalculatedExpenseReports" },
        { title: "Paid Expense Reports", path: "/expenseDashboard/PaidExpenseReports" },
        { title: "Paid Expenses", path: "/expenseDashboard/PaidExpenses" },
        { title: "Unpaid Expenses", path: "/expenseDashboard/UnPaidExpenses" },
        { title: "Commission Dashboard", path: "/commissionDashboard" },
        { title: "Commission Reports", path: "/commissionDashboard/Reports" },
        { title: "Commission Transactions", path: "/commissionDashboard/Transactions" },
      ],
    },
  };

  // ================= ACCESS LOGIC =================
  const departmentCode =
    profile?.roleAssignment?.departmentCode || "HR";

  const dashboardsToRender =
    departmentCode === "All"
      ? Object.values(dashboards)
      : [dashboards[departmentCode]].filter(Boolean);

  // ================= UI HELPERS =================
  const renderCards = (cards, gradient) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
      {cards.map((card, idx) => (
        <div
          key={idx}
          onClick={() => navigate(card.path)}
          className={`cursor-pointer bg-gradient-to-r ${gradient} text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1`}
        >
          <div className="flex items-center gap-2 mb-3">
            {card.icon}
            <h3 className="text-lg font-semibold">{card.title}</h3>
          </div>
          <p className="text-sm opacity-90">Click to open</p>
        </div>
      ))}
    </div>
  );

  // ================= RENDER =================
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* HEADER */}
      <div className="max-w-7xl mx-auto px-6 mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">OfferBerries</h1>
          <p className="text-gray-600">
            Welcome back, {profile?.individualName}
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate("/profile")}
            className="bg-white shadow p-3 rounded-lg flex items-center gap-2"
          >
            <FiUser />
            <span className="text-sm font-semibold">
              {profile?.individualName}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-lg flex items-center gap-2"
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      {/* DASHBOARDS */}
      <div className="max-w-7xl mx-auto px-6 space-y-16">
        {dashboardsToRender.map((dashboard, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-3 mb-6">
              {dashboard.icon}
              <h2 className="text-3xl font-bold text-gray-800">
                {dashboard.title}
              </h2>
            </div>
            {renderCards(dashboard.cards, dashboard.gradient)}
          </div>
        ))}
      </div>

      {/* FOOTER BADGE */}
      <div className="max-w-7xl mx-auto px-6 mt-12">
        <div className="bg-white shadow rounded-lg p-4 flex justify-between">
          <span className="text-sm text-gray-600">
            Department Access:{" "}
            <strong className="text-gray-900">
              {departmentCode}
            </strong>
          </span>

          {departmentCode === "All" && (
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
              Full Executive Access
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;

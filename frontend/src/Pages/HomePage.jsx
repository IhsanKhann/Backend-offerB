import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import { FiLogOut, FiUser } from "react-icons/fi";
import NotificationBell from "../components/NotificationsBell.jsx";

function HomePage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchResponse = async () => {
      try {
        const response = await api.get("/hello");
        setMessage(response.data.message);
      } catch (error) {
        console.error("Fetch error:", error);
        setMessage("Failed to fetch from backend");
      }
    };

    const fetchProfile = async () => {
      try {
        const res = await api.get("/auth/me");
        if (res.data.success) setProfile(res.data.employee);
      } catch (err) {
        console.error("Error fetching profile", err);
      }
    };

    fetchResponse();
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout", {});
      localStorage.removeItem("accessToken");
      window.location.reload();
    } catch (error) {
      console.error(error);
    }
  };

  // Department Gradients
  const gradients = {
    hr: "bg-gradient-to-r from-indigo-500 to-indigo-600",
    finance: "bg-gradient-to-r from-blue-500 to-blue-600",
    business: "bg-gradient-to-r from-purple-500 to-purple-600",
  };

  // HR / Admin Division Cards
  const hrCards = [
    { title: "My Profile", desc: "View and edit your profile", onClick: () => navigate("/profile"), icon: <FiUser size={24} /> },
    { title: "Employee Registration", desc: "Register new employees", onClick: () => navigate("/register-employee") },
    { title: "Draft Dashboard", desc: "Manage employee drafts", onClick: () => navigate("/DraftDashboard") },
    { title: "Admin Dashboard", desc: "Access admin reports", onClick: () => navigate("/admin/dashboard") },
    { title: "Assign Roles", desc: "Assign roles to employees", onClick: () => navigate("/assign-roles") },
    { title: "Permissions Management", desc: "Manage system permissions", onClick: () => navigate("/Permission-handler") },
    { title: "Notification Manager", desc: "Manage notification rules", onClick: () => navigate("/notification-manager") },
  ];

  // Finance Division Cards
  const financeCards = [
    { title: "Salary Dashboard", desc: "View/manage employee salaries", onClick: () => navigate("/salary-dashboard") },
    { title: "Account Statements", desc: "Track statements and payments", onClick: () => navigate("/accountStatements") },
    { title: "Paid Statements", desc: "View paid account statements", onClick: () => navigate("/accountStatements/paid") },
    { title: "Sellers Dashboard", desc: "Manage all sellers", onClick: () => navigate("/sellerDashboard") },
    { title: "Bidder Dashboard", desc: "Manage all bidders", onClick: () => navigate("/bidderDashboard") },
    { title: "Business Tables", desc: "View business breakup tables", onClick: () => navigate("/BussinessBreakupTables") },
    { title: "Salary History", desc: "View salary history", onClick: () => navigate("/salary/history") },
    { title: "Summary Table", desc: "View salary summary tables", onClick: () => navigate("/summary-table") },
    { title: "Rule Table", desc: "View salary rules", onClick: () => navigate("/tables") },
    { title: "Breakup Summary", desc: "View salary breakup", onClick: () => navigate("/salary/breakup") },
    { title: "Salary Rules Table", desc: "View salary rules table", onClick: () => navigate("/salary/rulesTable") },
  ];

  // Business Operations Division Cards
  const businessCards = [
    { title: "Expense Dashboard", desc: "Manage all expenses", onClick: () => navigate("/expenseDashboard") },
    { title: "Calculated Expense Reports", desc: "View calculated expense reports", onClick: () => navigate("/expenseDashboard/CalculatedExpenseReports") },
    { title: "Paid Expense Reports", desc: "View paid expense reports", onClick: () => navigate("/expenseDashboard/PaidExpenseReports") },
    { title: "Paid Expenses", desc: "Manage paid expenses", onClick: () => navigate("/expenseDashboard/PaidExpenses") },
    { title: "Unpaid Expenses", desc: "Manage unpaid expenses", onClick: () => navigate("/expenseDashboard/UnPaidExpenses") },
    { title: "Commission Dashboard", desc: "View commission stats", onClick: () => navigate("/commissionDashboard") },
    { title: "Commission Reports", desc: "View commission reports", onClick: () => navigate("/commissionDashboard/Reports") },
    { title: "Commission Transactions", desc: "Manage commission transactions", onClick: () => navigate("/commissionDashboard/Transactions") },
  ];

  // Helper to render cards
  const renderCards = (cards, gradient) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {cards.map((card, idx) => (
        <div
          key={idx}
          onClick={card.onClick}
          className={`cursor-pointer ${gradient} text-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between`}
        >
          <div className="flex items-center gap-2 mb-4">
            {card.icon && card.icon}
            <h2 className="text-xl font-semibold">{card.title}</h2>
          </div>
          <p className="text-sm opacity-90">{card.desc}</p>
          <div className="mt-4 text-sm font-medium opacity-90">→ Click to open</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 flex items-center justify-between">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">OfferBerries Dashboard</h1>
          <p className="text-gray-600 text-lg">{message || "Loading welcome message..."}</p>
        </div>

        <div className="flex items-center gap-4">
          {profile && (
            <div
              className="flex items-center gap-2 cursor-pointer bg-white shadow-lg rounded-xl p-3 hover:shadow-xl transition-shadow"
              onClick={() => navigate("/profile")}
            >
              <FiUser size={28} className="text-indigo-600" />
              <p className="font-semibold text-gray-900">{profile.individualName}</p>
            </div>
          )}
          <div className="bg-white shadow-lg rounded-xl p-2">
            <NotificationBell />
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg transition duration-200"
          >
            <FiLogOut className="mr-2" /> Logout
          </button>
        </div>
      </div>

      {/* HR/Admin */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">HR & Admin Division</h2>
        {renderCards(hrCards, gradients.hr)}
      </div>

      {/* Finance */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Finance Division</h2>
        {renderCards(financeCards, gradients.finance)}
      </div>

      {/* Business Operations */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Business Operations Division</h2>
        {renderCards(businessCards, gradients.business)}
      </div>
    </div>
  );
}

export default HomePage;

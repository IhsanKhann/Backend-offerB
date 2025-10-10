import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import { FiLogOut, FiUser } from "react-icons/fi";

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

  // 🧩 HR / Admin Division
  const cards = [
    {
      title: "My Profile",
      desc: "View and edit your profile",
      onClick: () => navigate("/profile"),
      icon: <FiUser size={24} />,
      color: "bg-gradient-to-r from-indigo-500 to-indigo-600",
    },
    {
      title: "Employee Registration",
      desc: "Register new employees into the system",
      onClick: () => navigate("/register-employee"),
      color: "bg-gradient-to-r from-blue-500 to-blue-600",
    },
    {
      title: "Draft Dashboard",
      desc: "View and manage employee drafts",
      onClick: () => navigate("/DraftDashboard"),
      color: "bg-gradient-to-r from-purple-500 to-purple-600",
    },
    {
      title: "Admin Dashboard",
      desc: "Access admin controls and reports",
      onClick: () => navigate("/admin/dashboard"),
      color: "bg-gradient-to-r from-green-500 to-green-600",
    },
    {
      title: "Assign Roles",
      desc: "Assign roles to employees",
      onClick: () => navigate("/assign-roles"),
      color: "bg-gradient-to-r from-yellow-500 to-yellow-600",
    },
    {
      title: "Permissions Management",
      desc: "Manage system permissions",
      onClick: () => navigate("/Permission-handler"),
      color: "bg-gradient-to-r from-red-500 to-red-600",
    },
  ];

  // 💰 Finance Division
  const financeCards = [
    {
      title: "Salary Dashboard",
      desc: "View and manage employee salaries",
      onClick: () => navigate("/salary-dashboard"),
      color: "bg-gradient-to-r from-teal-500 to-teal-600",
    },
    {
      title: "Account Statements",
      desc: "Track financial statements and payments",
      onClick: () => navigate("/accountStatements"),
      color: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    },
  ];

  // 🏢 Business Operations Division
  const businessOpsCards = [
    {
      title: "Seller Dashboard",
      desc: "Manage all sellers, their data, and actions",
      onClick: () => navigate("/sellerDashboard"),
      color: "bg-gradient-to-r from-pink-500 to-pink-600",
    },
    {
      title: "Bidder Dashboard",
      desc: "View and manage bidders and their statuses",
      onClick: () => navigate("/bidderDashboard"),
      color: "bg-gradient-to-r from-orange-500 to-orange-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 flex items-center justify-between">
        {/* Logo / Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            OfferBerries Dashboard
          </h1>
          <p className="text-gray-600 text-lg">
            {message || "Loading welcome message..."}
          </p>
        </div>

        {/* Profile Icon */}
        {profile && (
          <div
            className="flex items-center gap-2 cursor-pointer bg-white shadow-lg rounded-xl p-3"
            onClick={() => navigate("/profile")}
          >
            <FiUser size={28} className="text-indigo-600" />
            <p className="font-semibold text-gray-900">
              {profile.individualName}
            </p>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg transition duration-200"
        >
          <FiLogOut className="mr-2" /> Logout
        </button>
      </div>

      {/* HR / Admin Division */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          HR & Admin Division
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {cards.map((card, index) => (
            <div
              key={index}
              onClick={card.onClick}
              className={`cursor-pointer ${card.color} text-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between`}
            >
              <div className="flex items-center gap-2 mb-4">
                {card.icon && card.icon}
                <h2 className="text-xl font-semibold">{card.title}</h2>
              </div>
              <p className="text-sm opacity-90">{card.desc}</p>
              <div className="mt-4 text-sm font-medium opacity-90">
                → Click to open
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Finance Division */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Finance Division
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {financeCards.map((card, index) => (
            <div
              key={index}
              onClick={card.onClick}
              className={`cursor-pointer ${card.color} text-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between`}
            >
              <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
              <p className="text-sm opacity-90">{card.desc}</p>
              <div className="mt-4 text-sm font-medium opacity-90">
                → Click to open
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Business Operations Division */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Business Operations Division
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {businessOpsCards.map((card, index) => (
            <div
              key={index}
              onClick={card.onClick}
              className={`cursor-pointer ${card.color} text-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between`}
            >
              <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
              <p className="text-sm opacity-90">{card.desc}</p>
              <div className="mt-4 text-sm font-medium opacity-90">
                → Click to open
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HomePage;

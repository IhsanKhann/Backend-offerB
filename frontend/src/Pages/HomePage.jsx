import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import { FiLogOut } from "react-icons/fi";

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

  const cards = [
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

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="flex items-center justify-between">
          {/* Profile Card */}
          {profile && (
            <div className="bg-white shadow-lg rounded-xl flex flex-row items-center gap-2 px-4 py-3 w-86">
              <img
                src={profile.avatar?.url || "https://via.placeholder.com/50"}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover"
              />
              <div className="text-center">
                <p className="font-semibold text-gray-900">{profile.individualName}</p>
                <p className="text-gray-500 text-sm">{profile.personalEmail || profile.officialEmail}</p>
                <p className="text-gray-400 text-xs">ID: {profile.UserId}</p>
                <p className="text-gray-400 text-xs mt-1">Logged in as: {profile.role?.roleName || "N/A"}</p>
              </div>
            </div>
          )}

          {/* Logo / Title */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900">OfferBerries Dashboard</h1>
            <p className="text-gray-600 text-lg">{message || "Loading welcome message..."}</p>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg transition duration-200"
          >
            <FiLogOut className="mr-2" /> Logout
          </button>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {cards.map((card, index) => (
            <div
              key={index}
              onClick={card.onClick}
              className={`cursor-pointer ${card.color} text-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between`}
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
    </div>
  );
}

export default HomePage;

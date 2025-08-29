import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import { FiLogOut } from "react-icons/fi";

function HomePage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");

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
    fetchResponse();
  }, []);

  const handleLogout = async () => {
    try {
      const response = await api.post("/auth/logout", {});
      setMessage(response.data.message);
      localStorage.removeItem("accessToken");
      window.location.reload();
    } catch (error) {
      setMessage(error.response?.data?.message || "Logout failed");
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">OfferBerries Dashboard</h1>
            <p className="text-gray-600 text-lg">{message || "Loading welcome message..."}</p>
          </div>
          <button
            onClick={handleLogout}
            className="mt-4 md:mt-0 flex items-center bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg transition duration-200"
          >
            <FiLogOut className="mr-2" /> Logout
          </button>
        </div>

        {/* Dashboard Cards */}
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

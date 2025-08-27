// src/Pages/HomePage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchResponse = async () => {
      try {
        const response = await fetch("/api/hello");
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        setMessage(data.message);
      } catch (error) {
        console.error("Fetch error:", error);
        setMessage("Failed to fetch from backend");
      }
    };
    fetchResponse();
  }, []);

  const handleLogout = async () => {
    try {
      const response = await axios.post(
        "http://localhost:3000/api/auth/logout",
        {},
        { withCredentials: true } // this is for the cookies
      );
      setMessage(response.data.message);
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Something went wrong during logout."
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome to OfferBerries Dashboard
          </h1>
          <p className="text-gray-600 text-lg">{message || "Loading welcome message..."}</p>

        <button
          onClick={handleLogout}
          className="w-64 mt-4 bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition duration-200"
        >
          Logout
        </button>

        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            onClick={() => navigate("/register-employee")}
            className="cursor-pointer bg-white shadow-lg rounded-xl p-6 hover:shadow-2xl transition duration-300 flex flex-col items-center justify-center"
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Employee Registration</h2>
            <p className="text-gray-500 text-sm text-center">Register new employees into the system</p>
          </div>

          <div
            onClick={() => navigate("/DraftDashboard")}
            className="cursor-pointer bg-white shadow-lg rounded-xl p-6 hover:shadow-2xl transition duration-300 flex flex-col items-center justify-center"
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Draft Dashboard</h2>
            <p className="text-gray-500 text-sm text-center">View and manage employee drafts</p>
          </div>

          <div
            onClick={() => navigate("/admin/dashboard")}
            className="cursor-pointer bg-white shadow-lg rounded-xl p-6 hover:shadow-2xl transition duration-300 flex flex-col items-center justify-center"
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Admin Dashboard</h2>
            <p className="text-gray-500 text-sm text-center">Access admin controls and reports</p>
          </div>


        </div>
      </div>
    </div>
  );
}

export default HomePage;

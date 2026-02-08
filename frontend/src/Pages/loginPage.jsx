// src/pages/LoginPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";

const LoginPage = () => {
  const [UserId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      console.log("🔐 Attempting login with:", { UserId });

      // ✅ FIXED: Only send UserId and password (no email)
      const response = await api.post("/auth/login", {
        UserId,
        password,
      });

      console.log("✅ Login response:", response.data);

      if (response.data.status) {
        setMessage(response.data.message);

        // ✅ Store access token
        if (response.data.accessToken) {
          localStorage.setItem("accessToken", response.data.accessToken);
          console.log("✅ Token saved to localStorage");
        }

        console.log("✅ Redirecting to home...");
        // Small delay to show success message
        setTimeout(() => {
          navigate("/");
        }, 500);
      } else {
        setMessage(response.data.message || "Login failed");
        setLoading(false);
      }
    } catch (error) {
      console.error("❌ Login error:", error);
      console.error("❌ Error response:", error.response?.data);

      if (error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else if (error.response?.status === 401) {
        setMessage("Invalid credentials. Please check your User ID and password.");
      } else if (error.response?.status === 403) {
        setMessage(error.response.data.message || "Your account is blocked or suspended.");
      } else {
        setMessage("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  };

  const handlePasswordReset = () => {
    navigate("/reset-password");
  };

  const handleForgetUserId = () => {
    navigate("/forget-UserId");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="flex w-full max-w-5xl items-center justify-between px-6 gap-8">
        {/* Left Section */}
        <div className="w-1/2 hidden md:block text-white">
          <h1 className="text-6xl font-extrabold mb-4">
            Offer Berries
          </h1>
          <h2 className="text-2xl font-semibold opacity-90">
            Employee Portal
          </h2>
          <p className="mt-4 text-lg opacity-80">
            Access your dashboard, manage your profile, and stay connected.
          </p>
        </div>

        {/* Right Section - Login Form */}
        <div className="w-full md:w-1/2 bg-white shadow-2xl rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Login to your account
          </h2>

          {/* Success/Error Message */}
          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              message.includes("successfully") || message.includes("logged in")
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-gray-700 mb-2 font-medium">
                User ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={UserId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your User ID"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
                autoComplete="username"
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: AbdusSaboorKhanOBE1
              </p>
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-medium">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-semibold text-white transition duration-200 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Login"
              )}
            </button>

            <div className="flex flex-row justify-center items-center gap-6 pt-2">
              {/* Forgot Password */}
              <button
                type="button"
                onClick={handlePasswordReset}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition"
              >
                Forgot Password?
              </button>
              
              <span className="text-gray-400">•</span>

              {/* Forget UserId */}
              <button
                type="button"
                onClick={handleForgetUserId}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition"
              >
                Forgot User ID?
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-600">
            <p>Need help? Contact HR Department</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
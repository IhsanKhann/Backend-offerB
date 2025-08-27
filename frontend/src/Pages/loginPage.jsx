// src/pages/LoginPage.jsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

const LoginPage = () => {
  const [UserId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:3000/api/auth/login",
        { UserId, email, password },
        { withCredentials: true }
      );

      setMessage(response.data.message);
      setLoading(false);

      if (response.data.accessToken) {
        localStorage.setItem("accessToken", response.data.accessToken);
      }

      navigate("/");
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Something went wrong. Try again."
      );
      setLoading(false);
    }
  };

  const handlePasswordReset = () => {
    navigate("/reset-password");
  };

  const handleForgetUserId = () => {
    navigate("/forget-UserId");
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="flex w-full max-w-5xl items-center justify-between px-6">
        {/* Left Section */}
        <div className="w-1/2 hidden md:block">
          <h1 className="text-6xl font-extrabold text-blue-600">
            Offer Berries
          </h1>
          <h2 className="mt-4 text-2xl font-semibold text-gray-700">
            Employee Login
          </h2>
        </div>

        {/* Right Section - Login Form */}
        <div className="w-full md:w-1/2 bg-white shadow-lg rounded-xl p-8">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Login to your account
          </h2>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-gray-700 mb-2">User ID</label>
              <input
                type="text"
                value={UserId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your User ID"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <div className="flex flex-row justify-center align-center gap-8"> 
              {/* Forgot Password */}
              <div className="text-center mt-3 text-blue-600 cursor-pointer "
                onClick={handlePasswordReset}
              >
                  Forgot Password?
              </div>
              {/*  Forget UserId */}
              <div className="text-center mt-3 text-blue-600 cursor-pointer "
                onClick={handleForgetUserId}
              >
                  Forget UserId?
              </div>
            </div>
          </form>

          {message && (
            <p className="mt-4 text-center text-gray-700 font-medium">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

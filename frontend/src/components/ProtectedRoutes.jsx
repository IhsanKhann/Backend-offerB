import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setAuthenticated] = useState(null); // start as null

  useEffect(() => {
    const verifyUser = async () => {
      try {
        const res = await axios.get(
            "http://localhost:3000/api/auth/check-auth",
            { withCredentials: true } // ✅ This ensures cookies are sent
        );

        if (res.data.status) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      } catch (err) {
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    verifyUser();
  }, []);

    if (loading) return <p>Loading...</p>;
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;

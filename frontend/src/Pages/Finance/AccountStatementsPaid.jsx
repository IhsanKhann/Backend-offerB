import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar.jsx";
import api from "../../api/axios.js";
import { CheckCircle, Calendar, User } from "lucide-react";

const PaidStatements = () => {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { name: "Sellers Dashboard", path: "/sellers" },
    { name: "Pay Sellers ", path: "/sellerDashboard" },
    { name: "Account Statements", path: "/accountStatements" },
    { name: "Paid Statements", path: "/accountStatements/paid" },
  ];

  useEffect(() => {
    const fetchPaidStatements = async () => {
      try {
        setLoading(true);
        const res = await api.get("/statements?status=paid");
        setStatements(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch paid statements:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPaidStatements();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar
        navItems={navItems}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        title="Paid Account Statements"
      />

      <main className="flex-1 p-6 transition-all duration-300">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">
          Paid Account Statements
        </h2>

        {loading ? (
          <div className="flex justify-center items-center h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : statements.length === 0 ? (
          <p className="text-center text-gray-500 text-lg">
            No paid statements found.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {statements.map((st) => (
              <div
                key={st._id}
                className="relative bg-white rounded-2xl shadow-md hover:shadow-lg transition-all p-6 border border-gray-100"
              >
                {/* Paid Badge */}
                <div className="absolute top-3 right-3 bg-green-500 text-white text-xs px-3 py-1 rounded-full flex items-center space-x-1">
                  <CheckCircle size={14} />
                  <span>PAID</span>
                </div>

                {/* Seller Info */}
                <div className="flex items-center mb-3">
                  <div className="p-2 bg-blue-100 rounded-full mr-3">
                    <User size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Seller</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {st.sellerName || "Unknown Seller"}
                    </p>
                  </div>
                </div>

                {/* Period Info */}
                <div className="flex items-center mb-3">
                  <div className="p-2 bg-yellow-100 rounded-full mr-3">
                    <Calendar size={18} className="text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Period</p>
                    <p className="text-gray-800 text-sm">
                      {new Date(st.periodStart).toLocaleDateString()} →{" "}
                      {new Date(st.periodEnd).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="mt-4 border-t pt-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Total Amount:</span>{" "}
                    {st.totalAmount
                      ? `PKR ${st.totalAmount.toLocaleString()}`
                      : "N/A"}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Paid On:</span>{" "}
                    {st.paidAt
                      ? new Date(st.paidAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                  {st.referenceId && (
                    <p className="text-xs text-gray-400 mt-1">
                      Ref ID: {st.referenceId}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PaidStatements;

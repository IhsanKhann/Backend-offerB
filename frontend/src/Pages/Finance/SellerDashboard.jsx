import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog } from "@headlessui/react";
import Sidebar from "../../components/Sidebar.jsx";
import api from "../../api/axios.js";

const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

const SellerDashboard = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSellers, setSelectedSellers] = useState([]);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);

  // ✅ Fetch Sellers
  const fetchSellers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/sellers/all");
      setSellers(res.data.data || []);
    } catch (error) {
      console.error("Error fetching sellers:", error);
      alert("Failed to fetch sellers list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  // ✅ Select or Deselect Seller
  const toggleSelectSeller = (sellerId) => {
    setSelectedSellers((prev) =>
      prev.includes(sellerId)
        ? prev.filter((id) => id !== sellerId)
        : [...prev, sellerId]
    );
  };

  // ✅ Pay a Single Seller
  const paySeller = async (sellerId) => {
    if (!startDate || !endDate)
      return alert("Please select both start and end dates.");

    try {
      await api.post(`/statements/create/seller/${sellerId}`, {
        startDate,
        endDate,
      });
      alert("✅ Account statement created successfully for seller.");
    } catch (error) {
      console.error("Error paying seller:", error);
      alert("❌ Failed to process seller payment.");
    }
  };

  // ✅ Pay Selected Sellers
  const paySelectedSellers = async () => {
    if (selectedSellers.length === 0)
      return alert("Please select at least one seller.");

    if (!startDate || !endDate)
      return alert("Please select both start and end dates.");

    try {
      await api.post("/statements/create/selected", {
        sellerIds: selectedSellers,
        startDate,
        endDate,
      });
      alert("✅ Statements created for selected sellers.");
      setSelectedSellers([]);
    } catch (error) {
      console.error(error);
      alert("❌ Failed to process selected sellers payment.");
    }
  };

  // ✅ Pay All Sellers
  const payAllSellers = async () => {
    if (!startDate || !endDate)
      return alert("Please select both start and end dates.");

    try {
      await api.post("/statements/create/all", { startDate, endDate });
      alert("✅ Account statements created for all sellers.");
    } catch (error) {
      console.error(error);
      alert("❌ Failed to process all sellers payment.");
    }
  };

  // ✅ Open Pay Modal
  const openPayModal = async (sellerId) => {
    try {
      const res = await api.get(`/sellers/${sellerId}`);
      setSelectedSeller(res.data.data);
      setShowPayModal(true);
    } catch (error) {
      alert("❌ Failed to load seller details.");
    }
  };

  // ✅ Confirm Pay inside Modal
  const handlePaySeller = async () => {
    if (!startDate || !endDate)
      return alert("Please select both start and end dates.");

    try {
      await api.post(`/statements/create/seller/${selectedSeller._id}`, {
        startDate,
        endDate,
      });
      alert("✅ Seller paid successfully!");
      setShowPayModal(false);
    } catch (error) {
      alert("❌ Payment failed.");
    }
  };

  const navItems = [
    { name: "Sellers Dashboard", path: "/sellerDashboard" },
    { name: "Account Statements", path: "/accountStatements" },
    { name: "Paid Statements", path: "/accountStatements/paid" },
  ];
  
  if (loading) return <Loader />;

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="sticky top-0 h-screen">
        <Sidebar navItems={navItems} title="Seller Dashboard" />
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Sellers Payment Dashboard</h1>

          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border p-1 rounded"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border p-1 rounded"
            />

            <button
              onClick={payAllSellers}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Pay All Sellers
            </button>

            {selectedSellers.length > 0 && (
              <button
                onClick={paySelectedSellers}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Pay Selected ({selectedSellers.length})
              </button>
            )}
          </div>
        </div>

        {/* Seller List */}
        {sellers.length === 0 ? (
          <p className="text-gray-500">No sellers found.</p>
        ) : (
          <div className="space-y-3">
            {sellers.map((seller) => (
              <div
                key={seller._id}
                className="bg-white rounded-xl shadow-md p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:shadow-lg transition-all border border-gray-200"
              >
                {/* Seller Info */}
                <div className="flex items-center space-x-3 md:w-1/3">
                  <input
                    type="checkbox"
                    checked={selectedSellers.includes(seller._id)}
                    onChange={() => toggleSelectSeller(seller._id)}
                  />
                  <div className="flex flex-col">
                    <p className="text-base font-semibold text-gray-800">
                      {seller.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {seller.email || "No email"}
                    </p>
                    <p className="text-xs text-gray-400">
                      Business ID: {seller.businessSellerId || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Seller Stats */}
                <div className="mt-3 md:mt-0 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Total Orders:</span>{" "}
                    {seller.totalOrders ?? "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">Pending:</span>{" "}
                    {seller.totalPending ?? "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">Paid:</span>{" "}
                    {seller.totalPaid ?? "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">Current Balance:</span>{" "}
                    {seller.currentBalance ?? "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">Last Payment:</span>{" "}
                    {seller.lastPaymentDate
                      ? new Date(seller.lastPaymentDate).toLocaleDateString()
                      : "No payments yet"}
                  </p>
                </div>

                {/* Action Menu */}
                <div className="mt-3 md:mt-0 relative">
                  <button
                    onClick={() =>
                      setOpenActionMenu(
                        openActionMenu === seller._id ? null : seller._id
                      )
                    }
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full shadow text-xs flex items-center justify-between w-28"
                  >
                    Actions
                    <span
                      className={`ml-1 transition-transform duration-300 ${
                        openActionMenu === seller._id ? "rotate-180" : ""
                      }`}
                    >
                      ▼
                    </span>
                  </button>

                  <AnimatePresence>
                    {openActionMenu === seller._id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col overflow-hidden z-50"
                      >
                        <button
                          onClick={() => openPayModal(seller._id)}
                          className="px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        >
                          Pay Seller
                        </button>
                        <button
                          onClick={() =>
                            alert(`Breakup for ${seller.name} coming soon`)
                          }
                          className="px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        >
                          View Breakup
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pay Modal */}
        {showPayModal && (
          <Dialog
            open={showPayModal}
            onClose={() => setShowPayModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <div className="bg-white p-6 rounded-lg w-96 space-y-3">
              <h2 className="text-xl font-bold">Pay Seller</h2>
              <p className="text-sm text-gray-600">{selectedSeller?.name}</p>
              <p className="text-xs text-gray-500">{selectedSeller?.email}</p>

              <div className="flex flex-col gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border p-2 rounded"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border p-2 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 border rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePaySeller}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md"
                >
                  Confirm Pay
                </button>
              </div>
            </div>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default SellerDashboard;

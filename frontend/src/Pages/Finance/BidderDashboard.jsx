import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios.js";
import Sidebar from "../../components/Sidebar.jsx";

const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

const BidderDashboard = () => {
  const [bidders, setBidders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const dropdownRef = useRef(null);

  // Sidebar navigation
  const navItems = [
    { name: "Bidder Dashboard", path: "/bidderDashboard" },
    { name: "Seller Dashboard", path: "/sellerDashboard" },
    { name: "Account Statements", path: "/accountStatements" },
  ];

  // ✅ Fetch all bidders from your backend
  const fetchBidders = async () => {
    try {
      setLoading(true);
      const res = await api.get("/bidders/all");
      setBidders(res.data?.bidders || []);
    } catch (err) {
      console.error("Error fetching bidders:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Sync bidders from business side API
  const handleSyncBidders = async () => {
    try {
      setLoading(true);
      const res = await api.get("/bidders/sync");
      if (res.data.success) {
        alert("✅ Bidders synced successfully");
        fetchBidders();
      }
    } catch (err) {
      console.error("Error syncing bidders:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle bidder actions (approve, reject, etc.)
  const handleAction = async (action, id) => {
    try {
      const res = await api.patch(`/bidders/${action}/${id}`);
      if (res.data.success) {
        alert(`✅ Bidder ${action}d successfully`);
        fetchBidders();
      }
    } catch (err) {
      console.error(`Error performing ${action}:`, err);
      alert(`❌ Failed to ${action} bidder`);
    } finally {
      setOpenActionMenu(null);
    }
  };

  // 🧹 Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenActionMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchBidders();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="sticky top-0 h-screen">
        <Sidebar title="Bidders Dashboard" navItems={navItems} />
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Bidders
          </h1>
          <button
            onClick={handleSyncBidders}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow"
          >
            Sync Bidders
          </button>
        </div>

        {bidders.length === 0 ? (
          <p className="text-gray-500 text-sm md:text-base">No bidders found.</p>
        ) : (
          <div className="space-y-3">
            {bidders.map((bidder) => (
              <div
                key={bidder._id}
                className="bg-white rounded-xl shadow-md p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:shadow-lg transition-all border border-gray-200"
              >
                {/* Bidder Info */}
                <div className="flex items-center space-x-3 md:w-1/3">
                  {bidder.avatar?.url ? (
                    <img
                      src={bidder.avatar.url}
                      alt="Avatar"
                      className="w-16 h-16 rounded-full object-cover border border-blue-300"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-sm font-semibold">
                      N/A
                    </div>
                  )}
                  <div className="flex flex-col">
                    <p className="text-base font-semibold text-gray-800">
                      {bidder.name || "Unnamed Bidder"}
                    </p>
                    <p className="text-xs text-gray-500">{bidder.email}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <span className="text-xs text-gray-400">
                        ID: {bidder.bidderId || "N/A"}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        {bidder.status || "Pending"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bidder Details */}
                <div className="mt-3 md:mt-0 md:w-2/3 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Total Bids:</span>{" "}
                    {bidder.totalBids ?? "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">Total Won:</span>{" "}
                    {bidder.totalWon ?? "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">Joined:</span>{" "}
                    {bidder.createdAt
                      ? new Date(bidder.createdAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>

                {/* Action Menu */}
                <div className="mt-3 md:mt-0 relative" ref={dropdownRef}>
                  <button
                    onClick={() =>
                      setOpenActionMenu(
                        openActionMenu === bidder._id ? null : bidder._id
                      )
                    }
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full shadow text-xs flex items-center justify-between w-28"
                  >
                    Actions
                    <span
                      className={`ml-1 transition-transform duration-300 ${
                        openActionMenu === bidder._id ? "rotate-180" : ""
                      }`}
                    >
                      ▼
                    </span>
                  </button>

                  <AnimatePresence>
                    {openActionMenu === bidder._id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col overflow-hidden z-50"
                      >
                        {["approve", "reject", "suspend", "terminate", "block"].map(
                          (action) => (
                            <button
                              key={action}
                              onClick={() => handleAction(action, bidder._id)}
                              className="px-4 py-2 text-left hover:bg-gray-100 text-sm capitalize"
                            >
                              {action}
                            </button>
                          )
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BidderDashboard;

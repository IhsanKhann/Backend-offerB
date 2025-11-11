import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog } from "@headlessui/react";
import { Send, User, Calendar, Clock, DollarSign, ChevronDown } from "lucide-react";
import Sidebar from "../../components/Sidebar.jsx";
import api from "../../api/axios.js";

const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

const AccountStatementsDashboard = () => {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStatements, setSelectedStatements] = useState([]);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const navItems = [
    { name: "Sellers Dashboard", path: "/sellers" },
    { name: "Pay Sellers", path: "/sellerDashboard" },
    { name: "Account Statements", path: "/accountStatements" },
    { name: "Paid Statements", path: "/accountStatements/paid" },
  ];

  // ✅ Fetch pending statements
  const fetchStatements = async () => {
    console.log("🔍 Fetching pending statements...");
    try {
      setLoading(true);
      const res = await api.get("/statements?status=pending");
      console.log("✅ Fetched statements:", res.data.data);
      setStatements(res.data.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch statements:", err);
      alert("Failed to load account statements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  // ✅ Toggle selection
  const toggleSelect = (id) => {
    setSelectedStatements((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  // ✅ Generic send handler (single, bulk, or all)
  const handleSend = async (mode = "selected") => {
    try {
      setLoading(true);
      let payload = {};
      let actionType = "";
      let sellersInfo = [];

      if (mode === "all") {
        actionType = "ALL SELLERS";
        payload = { startDate, endDate };
        sellersInfo = statements.map((s) => ({
          sellerId: s.sellerId,
          sellerName: s.sellerName,
          statementId: s._id,
        }));
        console.group("📦 [DEBUG] Sending ALL Sellers Statements");
      } else if (mode === "selected" && selectedStatements.length > 0) {
        actionType = "BULK SELLERS";
        payload = { ids: selectedStatements };
        sellersInfo = statements
          .filter((s) => selectedStatements.includes(s._id))
          .map((s) => ({
            sellerId: s.sellerId,
            sellerName: s.sellerName,
            statementId: s._id,
          }));
        console.group("📦 [DEBUG] Sending BULK Sellers Statements");
      } else if (mode === "single" && selectedStatement) {
        actionType = "SINGLE SELLER";
        payload = { ids: [selectedStatement._id] };
        sellersInfo = [
          {
            sellerId: selectedStatement.sellerId,
            sellerName: selectedStatement.sellerName,
            statementId: selectedStatement._id,
          },
        ];
        console.group("📦 [DEBUG] Sending SINGLE Seller Statement");
      } else {
        alert("⚠️ No statements selected.");
        return;
      }

      // Log clear debugging info
      console.log("🧾 Action Type:", actionType);
      console.log("📆 Date Range:", { startDate, endDate });
      console.log("📤 Payload being sent to backend:", payload);
      console.table(sellersInfo);

      // Determine API route
      const route =
        mode === "all"
          ? `/statements/send/all`
          : `/statements/send`;

      console.log("🌐 API Route:", route);

      // Make request
      const res = await api.post(route, payload);
      console.log("✅ Backend Response:", res.data);
      console.groupEnd();

      // Notify user
      if (mode === "all")
        alert("✅ All pending statements sent successfully!");
      else if (mode === "selected")
        alert(`✅ ${selectedStatements.length} statements sent successfully!`);
      else alert("✅ Statement sent successfully!");

      // Refresh
      fetchStatements();
      setSelectedStatements([]);
      setShowSendModal(false);
    } catch (err) {
      console.error("❌ Error sending statements:", err);
      alert("❌ Failed to send statements.");
      console.groupEnd();
    } finally {
      setLoading(false);
    }
  };

  // ✅ Modal open for single statement
  const openSendModal = (statement) => {
    setSelectedStatement(statement);
    setShowSendModal(true);
  };

  if (loading) return <Loader />;

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar navItems={navItems} title="Pending Account Statements" />

      {/* Main Section */}
      <main className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-800">
            Pending Account Statements
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 text-sm p-2 rounded-md"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 text-sm p-2 rounded-md"
            />

            <button
              onClick={() => handleSend("all")}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-all"
            >
              Send All
            </button>

            {selectedStatements.length > 0 && (
              <button
                onClick={() => handleSend("selected")}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 transition-all"
              >
                Send Selected ({selectedStatements.length})
              </button>
            )}
          </div>
        </div>

       {/* Cards */}
{statements.length === 0 ? (
  <p className="text-gray-500 text-center mt-10">
    No pending statements found.
  </p>
) : (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {statements.map((st) => (
      <motion.div
        key={st._id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white rounded-2xl shadow-md hover:shadow-lg transition-all p-4 border border-gray-100 text-sm"
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selectedStatements.includes(st._id)}
          onChange={() => toggleSelect(st._id)}
          className="absolute top-3 left-3 accent-blue-600 h-4 w-4"
        />

        {/* Seller Info */}
        <div className="flex items-center mb-2 mt-1">
          <div className="p-2 bg-blue-100 rounded-full mr-2">
            <User size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Seller</p>
            <p className="text-sm font-semibold text-gray-800">
              {st.sellerName || "Unknown"}
            </p>
            <p className="text-xs text-gray-400">ID: {st.sellerId || "N/A"}</p>
          </div>
        </div>

        {/* Period Info */}
        <div className="flex items-center mb-1">
          <div className="p-2 bg-yellow-100 rounded-full mr-2">
            <Calendar size={16} className="text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Period</p>
            <p className="text-gray-800 text-xs">
              {new Date(st.periodStart).toLocaleDateString()} →{" "}
              {new Date(st.periodEnd).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center mb-1">
          <div className="p-2 bg-gray-100 rounded-full mr-2">
            <Clock size={16} className="text-gray-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Status</p>
            <p className="text-gray-800 text-xs capitalize">{st.status}</p>
          </div>
        </div>

        {/* Total Amount */}
        <div className="flex items-center mb-1">
          <div className="p-2 bg-green-100 rounded-full mr-2">
            <DollarSign size={16} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Amount</p>
            <p className="text-gray-800 text-xs">₹{st.totalAmount?.toFixed(2) || "0.00"}</p>
          </div>
        </div>

        {/* Orders Count */}
        <div className="flex items-center mb-1">
          <div className="p-2 bg-purple-100 rounded-full mr-2">
            <Clock size={16} className="text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Orders</p>
            <p className="text-gray-800 text-xs">{st.orders?.length || 0}</p>
          </div>
        </div>

        {/* Generated / Made / Paid Dates */}
        <div className="mb-1">
          <p className="text-xs text-gray-500 font-medium">Dates</p>
          <p className="text-gray-800 text-xs">
            Generated: {st.generatedAt ? new Date(st.generatedAt).toLocaleDateString() : "N/A"} |{" "}
            Made: {st.madeAt ? new Date(st.madeAt).toLocaleDateString() : "N/A"} |{" "}
            Paid: {st.paidAt ? new Date(st.paidAt).toLocaleDateString() : "N/A"}
          </p>
        </div>

        {/* Reference ID */}
        <div className="mb-1">
          <p className="text-xs text-gray-500 font-medium">Reference ID</p>
          <p className="text-gray-800 text-xs">{st.referenceId || "N/A"}</p>
        </div>

        {/* Breakups */}
        <div className="flex flex-col mb-2">
          <p className="text-xs text-gray-500 font-medium mb-1">Breakups</p>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
            {st.breakups?.map((b, idx) => (
              <span
                key={idx}
                className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full"
              >
                {b.description || "Item"}: ₹{b.amount?.toFixed(2) || "0.00"}
              </span>
            )) || <span className="text-gray-400 text-xs">No breakup</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t pt-2 mt-2 flex justify-between items-center">
          <button
            onClick={() => openSendModal(st)}
            className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md hover:bg-blue-100 transition-all"
          >
            <Send size={12} /> Send
          </button>

          <div className="relative">
            <button
              onClick={() =>
                setOpenActionMenu(openActionMenu === st._id ? null : st._id)
              }
              className="text-gray-600 text-xs flex items-center gap-1 hover:text-gray-800 transition-all"
            >
              Actions <ChevronDown size={12} />
            </button>
          </div>
        </div>
      </motion.div>
    ))}
  </div>
)}

        {/* Send Modal */}
        {showSendModal && (
          <Dialog
            open={showSendModal}
            onClose={() => setShowSendModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <div className="bg-white p-6 rounded-lg w-96 space-y-3">
              <h2 className="text-xl font-bold text-gray-800">
                Send Account Statement
              </h2>
              <p className="text-sm text-gray-600">
                {selectedStatement?.sellerName}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                Status: {selectedStatement?.status}
              </p>

              <div className="flex flex-col gap-2 mt-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border p-2 rounded text-sm"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border p-2 rounded text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowSendModal(false)}
                  className="px-4 py-2 border rounded-md text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSend("single")}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
                >
                  Confirm Send
                </button>
              </div>
            </div>
          </Dialog>
        )}
      </main>
    </div>
  );
};

export default AccountStatementsDashboard;

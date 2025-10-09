import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog } from "@headlessui/react";
import { Send, User, Calendar, Clock, ChevronDown } from "lucide-react";
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
    { name: "Sellers Dashboard", path: "/sellerDashboard" },
    { name: "Account Statements", path: "/accountStatements" },
    { name: "Paid Statements", path: "/accountStatements/paid" },
  ];

  // ✅ Fetch statements
  const fetchStatements = async () => {
    try {
      setLoading(true);
      const res = await api.get("/statements?status=pending");
      setStatements(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch statements:", err);
      alert("Failed to load account statements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  // ✅ Toggle statement selection
  const toggleSelect = (id) => {
    setSelectedStatements((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  // ✅ Send statements
  const sendStatement = async (ids) => {
    try {
      await api.post(`/statements/send`, { ids });
      alert("✅ Statements sent successfully!");
      fetchStatements();
      setSelectedStatements([]);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to send statements");
    }
  };

  // ✅ Send all
  const sendAllStatements = async () => {
    try {
      await api.post(`/statements/send/all`, { startDate, endDate });
      alert("✅ All statements sent!");
      fetchStatements();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to send all statements");
    }
  };

  // ✅ Open send modal
  const openSendModal = (statement) => {
    setSelectedStatement(statement);
    setShowSendModal(true);
  };

  if (loading) return <Loader />;

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar navItems={navItems} title="Pending Account Statements" />

      {/* Main Content */}
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
              onClick={sendAllStatements}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-all"
            >
              Send All
            </button>

            {selectedStatements.length > 0 && (
              <button
                onClick={() => sendStatement(selectedStatements)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {statements.map((st) => (
              <motion.div
                key={st._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-white rounded-2xl shadow-md hover:shadow-lg transition-all p-6 border border-gray-100"
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedStatements.includes(st._id)}
                  onChange={() => toggleSelect(st._id)}
                  className="absolute top-4 left-4 accent-blue-600 h-4 w-4"
                />

                {/* Seller Info */}
                <div className="flex items-center mb-4 mt-2">
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
                      {st.periodStart} → {st.periodEnd}
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-gray-100 rounded-full mr-3">
                    <Clock size={18} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Status</p>
                    <p className="text-gray-800 text-sm capitalize">
                      {st.status || "Pending"}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t pt-3 mt-3 flex justify-between items-center">
                  <button
                    onClick={() => openSendModal(st)}
                    className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-all"
                  >
                    <Send size={14} /> Send
                  </button>

                  <div className="relative">
                    <button
                      onClick={() =>
                        setOpenActionMenu(
                          openActionMenu === st._id ? null : st._id
                        )
                      }
                      className="text-gray-600 text-sm flex items-center gap-1 hover:text-gray-800 transition-all"
                    >
                      Actions <ChevronDown size={14} />
                    </button>

                    <AnimatePresence>
                      {openActionMenu === st._id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col overflow-hidden z-50"
                        >
                          <button
                            onClick={() => openSendModal(st)}
                            className="px-4 py-2 text-left hover:bg-gray-100 text-sm"
                          >
                            Send Statement
                          </button>
                          <button
                            onClick={() => alert('Breakup feature coming soon')}
                            className="px-4 py-2 text-left hover:bg-gray-100 text-sm"
                          >
                            View Breakup
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                  onClick={() => sendStatement([selectedStatement._id])}
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

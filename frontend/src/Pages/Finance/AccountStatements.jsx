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

  // ✅ Toggle select statement
  const toggleSelect = (id) => {
    setSelectedStatements((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  // ✅ Send a single statement
  const sendStatement = async (statementId) => {
    try {
      await api.post(`/statements/send`, { ids: [statementId] });
      alert("✅ Statement sent successfully!");
      fetchStatements();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to send statement");
    }
  };

  // ✅ Send selected statements
  const sendSelectedStatements = async () => {
    if (selectedStatements.length === 0) return alert("Select at least one statement");
    try {
      await api.post(`/statements/send`, { ids: selectedStatements });
      alert("✅ Selected statements sent!");
      setSelectedStatements([]);
      fetchStatements();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to send selected statements");
    }
  };

  // ✅ Send all statements
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

  // ✅ Open send modal for single statement
  const openSendModal = (statement) => {
    setSelectedStatement(statement);
    setShowSendModal(true);
  };

  // ✅ Confirm send inside modal
  const handleSendStatement = async () => {
    try {
      await api.post(`/statements/send`, { ids: [selectedStatement._id] });
      alert("✅ Statement sent successfully!");
      setShowSendModal(false);
      fetchStatements();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to send statement");
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="sticky top-0 h-screen">
        <Sidebar navItems={navItems} title="Account Statements" />
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Pending Account Statements</h1>

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
              onClick={sendAllStatements}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Send All
            </button>
            {selectedStatements.length > 0 && (
              <button
                onClick={sendSelectedStatements}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Send Selected ({selectedStatements.length})
              </button>
            )}
          </div>
        </div>

        {statements.length === 0 ? (
          <p className="text-gray-500">No pending statements.</p>
        ) : (
          <div className="space-y-3">
            {statements.map((st) => (
              <div
                key={st._id}
                className="bg-white rounded-xl shadow-md p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:shadow-lg transition-all border border-gray-200"
              >
                <div className="flex items-center space-x-3 md:w-1/3">
                  <input
                    type="checkbox"
                    checked={selectedStatements.includes(st._id)}
                    onChange={() => toggleSelect(st._id)}
                  />
                  <div className="flex flex-col">
                    <p className="text-base font-semibold text-gray-800">
                      {st.sellerName || "Unknown Seller"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Period: {st.startDate} → {st.endDate}
                    </p>
                    <p className="text-xs text-gray-400">
                      Status: {st.status}
                    </p>
                  </div>
                </div>

                {/* Action menu */}
                <div className="mt-3 md:mt-0 relative">
                  <button
                    onClick={() =>
                      setOpenActionMenu(openActionMenu === st._id ? null : st._id)
                    }
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full shadow text-xs flex items-center justify-between w-28"
                  >
                    Actions
                    <span
                      className={`ml-1 transition-transform duration-300 ${
                        openActionMenu === st._id ? "rotate-180" : ""
                      }`}
                    >
                      ▼
                    </span>
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
                          Send
                        </button>
                        <button
                          onClick={() => alert("Breakup coming soon")}
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

        {/* Send Modal */}
        {showSendModal && (
          <Dialog
            open={showSendModal}
            onClose={() => setShowSendModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <div className="bg-white p-6 rounded-lg w-96 space-y-3">
              <h2 className="text-xl font-bold">Send Account Statement</h2>
              <p className="text-sm text-gray-600">{selectedStatement?.sellerName}</p>
              <p className="text-xs text-gray-500">Status: {selectedStatement?.status}</p>

              <div className="flex flex-col gap-2 mt-2">
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
                  onClick={() => setShowSendModal(false)}
                  className="px-4 py-2 border rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendStatement}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md"
                >
                  Confirm Send
                </button>
              </div>
            </div>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default AccountStatementsDashboard;

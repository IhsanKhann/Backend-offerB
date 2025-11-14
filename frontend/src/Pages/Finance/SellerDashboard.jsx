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
  
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [showCycleManager, setShowCycleManager] = useState(false);
  
  const [cycleForm, setCycleForm] = useState({ name: "", startDate: "", endDate: "", description: "" });
  const [editingCycleId, setEditingCycleId] = useState(null);
  
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [orderStatus, setOrderStatus] = useState({ paid: [], unpaid: [], processing: [] });

  // Fetch sellers
  const fetchSellers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/sellers/all");
      const fetched = res.data?.sellers || res.data?.data || [];
      setSellers(fetched);
    } catch (error) {
      console.error("Error fetching sellers:", error);
      alert("Failed to fetch sellers list.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch cycles
  const fetchCycles = async () => {
    try {
      const res = await api.get("/cycles/all");
      setCycles(res.data?.cycles || []);
    } catch (error) {
      console.error("Error fetching cycles:", error);
      alert("Failed to fetch cycles.");
    }
  };

  useEffect(() => {
    fetchSellers();
    fetchCycles();
  }, []);

  const toggleSelectSeller = (businessSellerId) => {
    setSelectedSellers((prev) =>
      prev.includes(businessSellerId)
        ? prev.filter((id) => id !== businessSellerId)
        : [...prev, businessSellerId]
    );
  };

  // Open Pay Modal
  const openPayModal = (seller = null, bulk = false) => {
    setSelectedSeller(seller);
    setShowPayModal(true);
    setSelectedCycle(null);
    setStartDate("");
    setEndDate("");
  };

  // Cycle select
  const handleCycleChange = (cycleId) => {
    const cycle = cycles.find((c) => c._id === cycleId);
    if (!cycle) return;
    setSelectedCycle(cycle);
    setStartDate(cycle.startDate);
    setEndDate(cycle.endDate);
  };

  // Pay seller or bulk
  const handlePay = async () => {
    if (!startDate || !endDate) return alert("Select both start and end dates.");

    try {
      if (selectedSeller) {
        // Single seller
        await api.post(`/statements/create/seller/${selectedSeller.businessSellerId}`, { startDate, endDate });
        alert(`✅ Seller ${selectedSeller.name} paid successfully!`);
      } else if (selectedSellers.length > 0) {
        // Selected sellers
        await api.post("/statements/create/selected", {
          sellerIds: selectedSellers,
          startDate,
          endDate,
        });
        alert("✅ Statements created for selected sellers.");
        setSelectedSellers([]);
      } else {
        // All sellers
        await api.post("/statements/create/all", { startDate, endDate });
        alert("✅ Account statements created for all sellers.");
      }

      setShowPayModal(false);
      setSelectedCycle(null);
      setStartDate("");
      setEndDate("");
    } catch (error) {
      console.error("Payment failed:", error);
      alert("❌ Payment failed.");
    }
  };

  // Cycle Manager Handlers
  const handleCycleFormChange = (e) => setCycleForm({ ...cycleForm, [e.target.name]: e.target.value });
  const openEditCycle = (cycle) => {
    setEditingCycleId(cycle._id);
    setCycleForm({ name: cycle.name, startDate: cycle.startDate, endDate: cycle.endDate, description: cycle.description });
    setShowCycleManager(true);
  };

  const createOrUpdateCycle = async () => {
    try {
      if (editingCycleId) {
        await api.put(`/cycles/update/${editingCycleId}`, cycleForm);
        alert("Cycle updated successfully!");
      } else {
        await api.post("/cycles/create", cycleForm);
        alert("Cycle created successfully!");
      }
      fetchCycles();
      setCycleForm({ name: "", startDate: "", endDate: "", description: "" });
      setEditingCycleId(null);
      setShowCycleManager(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save cycle.");
    }
  };

  const deleteCycle = async (id) => {
    if (!window.confirm("Are you sure you want to delete this cycle?")) return;
    try {
      await api.delete(`/cycles/delete/${id}`);
      fetchCycles();
      alert("Cycle deleted successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to delete cycle.");
    }
  };

  const openOrderStatusModal = async (seller) => {
  try {
    setSelectedSeller(seller);
    setShowOrdersModal(true);

    const res = await api.get(`/statements/${seller.businessSellerId}/orderstatus`);

    setOrderStatus({
      paid: res.data.paid || [],
      processing: res.data.processing || [],
      unpaid: res.data.unpaid || [],
    });
  } catch (err) {
    console.error("Error loading order status:", err);
    alert("Failed to load order status.");
  }
  };

  const navItems = [
    { name: "Sellers Dashboard", path: "/sellers" },
    { name: "Pay Sellers", path: "/sellerDashboard" },
    { name: "Account Statements", path: "/accountStatements" },
    { name: "Paid Statements", path: "/accountStatements/paid" },
  ];

  if (loading) return <Loader />;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="sticky top-0 h-screen">
        <Sidebar navItems={navItems} title="Seller Dashboard" />
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Sellers Payment Dashboard</h1>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => openPayModal(null)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Pay All / Selected Sellers
            </button>
          </div>
        </div>

     {/* Seller Cards */}
{sellers.length === 0 ? (
  <p className="text-gray-500">No sellers found.</p>
) : (
  <div className="space-y-3">
    {sellers.map((seller) => (
      <div
        key={seller.businessSellerId}
        className="bg-white rounded-xl shadow-md p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:shadow-lg transition-all border border-gray-200"
      >
        {/* Checkbox + Basic Info */}
        <div className="flex items-center space-x-3 md:w-1/3">
          <input
            type="checkbox"
            checked={selectedSellers.includes(seller.businessSellerId)}
            onChange={() => toggleSelectSeller(seller.businessSellerId)}
          />
          <div className="flex flex-col">
            <p className="text-base font-semibold text-gray-800">{seller.name}</p>
            <p className="text-xs text-gray-500">{seller.email || "No email"}</p>
            <p className="text-xs text-gray-400">
              Business ID: {seller.businessSellerId || "N/A"}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 md:mt-0 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-700 w-full md:w-auto">
          <p>
            <span className="font-medium">Total Orders:</span> {seller.totalOrders ?? 0}
          </p>
          <p>
            <span className="font-medium">Pending Orders:</span> {seller.pendingOrders ?? 0}
          </p>
          <p>
            <span className="font-medium">Paid Orders:</span> {seller.paidOrders ?? 0}
          </p>
          <p>
            <span className="font-medium">Current Balance:</span> ₨{seller.currentBalance?.toLocaleString() ?? 0}
          </p>
          <p>
            <span className="font-medium">Total Receivable:</span> ₨{seller.totalReceivableAmount?.toLocaleString() ?? 0}
          </p>
          <p>
            <span className="font-medium">Paid Receivable:</span> ₨{seller.paidReceivableAmount?.toLocaleString() ?? 0}
          </p>
          <p>
            <span className="font-medium">Remaining Receivable:</span> ₨{seller.remainingReceivableAmount?.toLocaleString() ?? 0}
          </p>
          <p>
            <span className="font-medium">Last Payment:</span>{" "}
            {seller.lastPaymentDate ? new Date(seller.lastPaymentDate).toLocaleDateString() : "No payments yet"}
          </p>
        </div>

       {/* Action Menu */}
        <div className="mt-3 md:mt-0 relative">
          <button
            onClick={() => setOpenActionMenu(openActionMenu === seller.businessSellerId ? null : seller.businessSellerId)}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full shadow text-xs"
          >
            Actions ▾
          </button>

          {openActionMenu === seller.businessSellerId && (
            <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-md z-20">
              <button
                onClick={() => {
                  openPayModal(seller);
                  setOpenActionMenu(null);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                Pay Seller
              </button>

              <button
                onClick={() => {
                  openOrderStatusModal(seller);
                  setOpenActionMenu(null);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                View Orders
              </button>
            </div>
          )}
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
              <h2 className="text-xl font-bold">
                {selectedSeller ? `Pay ${selectedSeller.name}` : "Pay Sellers"}
              </h2>

              <label className="text-sm font-medium">Select Cycle</label>
              <select
                className="border p-2 rounded w-full"
                value={selectedCycle?._id || ""}
                onChange={(e) => handleCycleChange(e.target.value)}
              >
                <option value="">-- Choose Cycle --</option>
                {cycles.map((cycle) => (
                  <option key={cycle._id} value={cycle._id}>
                    {cycle.name} ({cycle.startDate} → {cycle.endDate})
                  </option>
                ))}
              </select>

             <label className="text-sm font-medium mt-2">Or Enter Dates Manually</label>
              <div className="flex flex-col gap-1">
                <div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border p-2 rounded w-full"
                  />
                  {startDate && <p className="text-xs text-gray-400">From: {startDate} 00:00:00</p>}
                </div>
                <div>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border p-2 rounded w-full"
                  />
                  {endDate && <p className="text-xs text-gray-400">To: {endDate} 23:59:59</p>}
                </div>
              </div>


              <div className="flex justify-between mt-2">
                <button
                  onClick={() => setShowCycleManager(true)}
                  className="px-3 py-1 bg-gray-200 rounded"
                >
                  Manage Cycles
                </button>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 border rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePay}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md"
                >
                  Confirm Pay
                </button>
              </div>
            </div>
          </Dialog>
        )}

        {/* Cycle Manager Modal */}
        {showCycleManager && (
          <Dialog
            open={showCycleManager}
            onClose={() => setShowCycleManager(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <div className="bg-white p-6 rounded-lg w-96 space-y-3">
              <h2 className="text-xl font-bold">Cycle Manager</h2>

              <input
                type="text"
                name="name"
                placeholder="Cycle Name"
                value={cycleForm.name}
                onChange={handleCycleFormChange}
                className="border p-2 rounded w-full"
              />
              <input
                type="date"
                name="startDate"
                value={cycleForm.startDate}
                onChange={handleCycleFormChange}
                className="border p-2 rounded w-full"
              />
              {cycleForm.startDate && <p className="text-xs text-gray-400">From: {cycleForm.startDate} 00:00:00</p>}

              <input
                type="date"
                name="endDate"
                value={cycleForm.endDate}
                onChange={handleCycleFormChange}
                className="border p-2 rounded w-full"
              />
              {cycleForm.endDate && <p className="text-xs text-gray-400">To: {cycleForm.endDate} 23:59:59</p>}

              <input
                type="text"
                name="description"
                placeholder="Description"
                value={cycleForm.description}
                onChange={handleCycleFormChange}
                className="border p-2 rounded w-full"
              />

              <div className="flex justify-between gap-2 mt-4">
                {editingCycleId && (
                  <button
                    onClick={() => deleteCycle(editingCycleId)}
                    className="px-4 py-2 bg-red-600 text-white rounded"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={createOrUpdateCycle}
                  className="px-4 py-2 bg-green-600 text-white rounded"
                >
                  {editingCycleId ? "Update Cycle" : "Create Cycle"}
                </button>
              </div>

              <div className="mt-3">
                <h3 className="font-semibold text-sm mb-1">Existing Cycles</h3>
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {cycles.map((c) => (
                    <li
                      key={c._id}
                      className="flex justify-between items-center bg-gray-100 px-2 py-1 rounded"
                    >
                      <span>
                        {c.name} ({c.startDate} → {c.endDate})
                      </span>
                      <button
                        onClick={() => openEditCycle(c)}
                        className="text-blue-600 text-sm"
                      >
                        Edit
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Dialog>
        )}

        {/* Orders Status Modal */}
        {showOrdersModal && (
          <Dialog
            open={showOrdersModal}
            onClose={() => setShowOrdersModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <div className="bg-white w-[95vw] max-w-[1200px] h-[90vh] overflow-y-auto p-8 rounded-xl shadow-2xl space-y-6">

              {/* Header */}
              <h2 className="text-3xl font-bold text-center mb-4">
                Order Status – {selectedSeller?.name}
              </h2>

              {/* 3-Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Paid Orders */}
                <div className="border rounded-xl p-4 bg-green-50 shadow-sm">
                  <h3 className="text-lg font-semibold text-green-700 mb-3">
                    Paid Orders ({orderStatus.paid.length})
                  </h3>

                  <div className="space-y-2 text-sm">
                    {orderStatus.paid.length === 0 && (
                      <p className="text-gray-500 text-xs">No paid orders.</p>
                    )}

                    {orderStatus.paid.map((o) => (
                      <div
                        key={o.breakupId}
                        className="p-2 border rounded-lg bg-white shadow-sm"
                      >
                        <p><span className="font-medium">Order ID:</span> {o.orderId}</p>
                        <p><span className="font-medium">Amount:</span> ₨{o.actualAmount?.toLocaleString()}</p>
                        <p>
                          <span className="font-medium">Paid At:</span>{" "}
                          {o.paymentClearedDate
                            ? new Date(o.paymentClearedDate).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Processing Orders */}
                <div className="border rounded-xl p-4 bg-yellow-50 shadow-sm">
                  <h3 className="text-lg font-semibold text-yellow-700 mb-3">
                    Processing Orders ({orderStatus.processing.length})
                  </h3>

                  <div className="space-y-2 text-sm">
                    {orderStatus.processing.length === 0 && (
                      <p className="text-gray-500 text-xs">No processing orders.</p>
                    )}

                    {orderStatus.processing.map((o) => (
                      <div
                        key={o.breakupId}
                        className="p-2 border rounded-lg bg-white shadow-sm"
                      >
                        <p><span className="font-medium">Order ID:</span> {o.orderId}</p>
                        <p><span className="font-medium">Amount:</span> ₨{o.actualAmount?.toLocaleString()}</p>
                        <p><span className="font-medium">Created:</span> {new Date(o.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unpaid Orders */}
                <div className="border rounded-xl p-4 bg-red-50 shadow-sm">
                  <h3 className="text-lg font-semibold text-red-700 mb-3">
                    Unpaid Orders ({orderStatus.unpaid.length})
                  </h3>

                  <div className="space-y-2 text-sm">
                    {orderStatus.unpaid.length === 0 && (
                      <p className="text-gray-500 text-xs">No unpaid orders.</p>
                    )}

                    {orderStatus.unpaid.map((o) => (
                      <div
                        key={o.breakupId}
                        className="p-2 border rounded-lg bg-white shadow-sm"
                      >
                        <p><span className="font-medium">Order ID:</span> {o.orderId}</p>
                        <p><span className="font-medium">Amount:</span> ₨{o.actualAmount?.toLocaleString()}</p>
                        <p><span className="font-medium">Created:</span> {new Date(o.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Close Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowOrdersModal(false)}
                  className="px-6 py-2 mt-4 bg-gray-300 hover:bg-gray-400 rounded-md"
                >
                  Close
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

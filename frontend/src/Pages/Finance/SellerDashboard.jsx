import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import Sidebar from "../../components/Sidebar.jsx";
import OrderBreakupModal from "../../components/OrderModal.jsx";

const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

const SellerDashboard = ({ sellerId }) => {
  const [orders, setOrders] = useState([]);
  const [selectedBreakup, setSelectedBreakup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Fetch all orders for seller
  const fetchOrders = async () => {
    try {
      const res = await api.get(`/transactions/orders/seller/${sellerId}`);
      const fetchedOrders = res.data?.data || [];
      setOrders(fetchedOrders);
    } catch (err) {
      console.error("❌ Failed to fetch seller orders:", err);
    }
  };

  // Fetch parent breakup for a specific order (auction or regular)
  const fetchBreakupForOrder = async (orderId) => {
    try {
      const res = await api.get(`/transactions/orders/${orderId}/parent-breakup`);
      setSelectedBreakup(res.data || null);
    } catch (err) {
      console.error("❌ Failed to fetch parent breakup:", err);
      setSelectedBreakup(null);
    }
  };

  useEffect(() => {
    if (sellerId) {
      setLoading(true);
      fetchOrders().finally(() => setLoading(false));
    }
  }, [sellerId]);

  const handleViewBreakup = async (order) => {
    setSelectedOrder(order);
    await fetchBreakupForOrder(order._id);
  };

  if (loading) return <Loader />;

  const navItems = [{ name: "Seller Dashboard", path: "/sellerDashboard" }];

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar navItems={navItems} title="SellerDashboard" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Seller Dashboard</h1>

        {/* Orders Section */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Orders</h2>
          {orders.length === 0 ? (
            <p className="text-gray-500 text-sm md:text-base">No orders found.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="bg-white rounded-xl shadow-md p-4 flex flex-col md:flex-row justify-between items-start md:items-center border border-gray-200"
                >
                  <div>
                    <p className="text-base font-semibold text-gray-800">
                      Order ID: {order._id}
                    </p>
                    <p className="text-sm text-gray-500">
                      Buyer: {order.buyer?.name || "N/A"}
                    </p>
                    <p className="text-sm text-gray-500">
                      Total: PKR {order.order_total_amount?.toLocaleString() || "N/A"}
                    </p>
                    <p className="text-sm text-gray-500">
                      Type: {order.transaction_type || "N/A"}
                    </p>
                  </div>
                  <div className="mt-3 md:mt-0">
                    <button
                      onClick={() => handleViewBreakup(order)}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg shadow"
                    >
                      View Breakup
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Breakup Modal */}
        {selectedOrder && selectedBreakup && (
          <OrderBreakupModal
            order={selectedOrder}
            breakups={selectedBreakup.lines || []}
            isOpen={!!selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        )}
      </div>
    </div>
  );
};

export default SellerDashboard;

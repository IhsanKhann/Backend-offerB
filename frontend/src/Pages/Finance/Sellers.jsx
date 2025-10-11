import React, { useEffect, useState, useRef } from "react";
import api from "../../api/axios.js";
import Sidebar from "../../components/Sidebar.jsx";

const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

const SellerDashboard = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const menuRef = useRef(null);

  const navItems = [
    { name: "Sellers Dashboard", path: "/sellers" },
    { name: "Pay Sellers", path: "/sellerDashboard" },
    { name: "Account Statements", path: "/accountStatements" },
    { name: "Paid Statements", path: "/accountStatements/paid" },
  ];

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/sellers/all");
      setSellers(res.data?.data || []);
    } catch (err) {
      console.error("Error fetching sellers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSellers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/sellers/sync");
      if (res.data.success) {
        alert("✅ Sellers synced successfully");
        fetchSellers();
      }
    } catch (err) {
      console.error("Error syncing sellers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action, id) => {
    try {
      const res = await api.patch(`/sellers/${action}/${id}`);
      if (res.data.success) {
        alert(`✅ Seller ${action}d successfully`);
        fetchSellers();
      }
    } catch (err) {
      console.error(`Error performing ${action}:`, err);
      alert(`❌ Failed to ${action} seller`);
    } finally {
      setOpenMenuId(null);
    }
  };

  const toggleMenu = (id) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchSellers();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="sticky top-0 h-screen">
        <Sidebar title="Sellers Dashboard" navItems={navItems} />
      </div>

      <div className="flex-1 p-6 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Sellers</h1>
          <button
            onClick={handleSyncSellers}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition-colors"
          >
            Sync Sellers
          </button>
        </div>

        {sellers.length === 0 ? (
          <p className="text-gray-500 text-sm md:text-base">No sellers found.</p>
        ) : (
          <div className="space-y-4">
            {sellers.map((seller) => (
              <div
                key={seller.id}
                ref={menuRef}
                className={`bg-white rounded-xl shadow-md p-6 border border-gray-200 transition-all duration-300 ${
                  openMenuId === seller.id ? "ring-2 ring-blue-200" : "hover:shadow-lg"
                }`}
              >
                {/* Seller Info */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="flex items-center space-x-4 lg:w-2/5">
                    {seller.image ? (
                      <img
                        src={`https://your-image-base-url.com/${seller.image}`}
                        alt={seller.f_name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-blue-300"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-semibold">
                        N/A
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-semibold capitalize text-gray-800">
                        {seller.f_name} {seller.l_name}
                      </p>
                      <p className="text-sm text-gray-500">{seller.email}</p>
                      <p className="text-sm text-gray-500"> {seller.phone}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                          ID: {seller.id}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {seller.status || "Pending"}
                        </span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          {seller.app_language?.toUpperCase() || "EN"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bank & Account Info */}
                  <div className="lg:w-2/5 grid grid-cols-2 gap-3 text-sm text-gray-700">
                    <p><span className="font-medium">Bank:</span> {seller.bank_name || "N/A"}</p>
                    <p><span className="font-medium">Branch:</span> {seller.branch || "N/A"}</p>
                    <p><span className="font-medium">Account #:</span> {seller.account_no || "N/A"}</p>
                    <p><span className="font-medium">Holder:</span> {seller.holder_name || "N/A"}</p>
                    <p><span className="font-medium">POS:</span> {seller.pos_status ? "Active" : "Inactive"}</p>
                    <p><span className="font-medium">GST:</span> {seller.gst || "N/A"}</p>
                  </div>

                  {/* Actions Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMenu(seller.id);
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg shadow text-sm font-medium border border-gray-300"
                  >
                    {openMenuId === seller.id ? "Close Actions" : "Actions"}
                  </button>
                </div>

                {/* Horizontal Attached Action Menu */}
                {openMenuId === seller.id && (
                  <div className="mt-4 border-t border-gray-200 pt-3 flex flex-wrap gap-3 justify-center lg:justify-start">
                    {["approve", "reject", "suspend", "terminate", "block"].map((action) => (
                      <button
                        key={action}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(action, seller.id);
                        }}
                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-sm font-medium transition-colors"
                      >
                        {action.charAt(0).toUpperCase() + action.slice(1)}
                      </button>
                    ))}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSeller(seller);
                        setOpenMenuId(null);
                      }}
                      className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-md text-sm font-medium transition-colors"
                    >
                      View Profile
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {selectedSeller && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
          onClick={() => setSelectedSeller(null)}
        >
          <div
            className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Seller Profile</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
              <p><span className="font-medium">Full Name:</span> {selectedSeller.f_name} {selectedSeller.l_name}</p>
              <p><span className="font-medium">Email:</span> {selectedSeller.email}</p>
              <p><span className="font-medium">Phone:</span> {selectedSeller.phone}</p>
              <p><span className="font-medium">Status:</span> {selectedSeller.status}</p>
              <p><span className="font-medium">Language:</span> {selectedSeller.app_language?.toUpperCase()}</p>
              <p><span className="font-medium">Created At:</span> {new Date(selectedSeller.created_at).toLocaleString()}</p>
              <p><span className="font-medium">Updated At:</span> {new Date(selectedSeller.updated_at).toLocaleString()}</p>
              <p><span className="font-medium">Email Verified:</span> {selectedSeller.is_email_verified ? "Yes" : "No"}</p>
              <p><span className="font-medium">Phone Verified:</span> {selectedSeller.is_phone_verified ? "Yes" : "No"}</p>
              <p><span className="font-medium">Bank Name:</span> {selectedSeller.bank_name || "N/A"}</p>
              <p><span className="font-medium">Branch:</span> {selectedSeller.branch || "N/A"}</p>
              <p><span className="font-medium">Account #:</span> {selectedSeller.account_no || "N/A"}</p>
              <p><span className="font-medium">Holder Name:</span> {selectedSeller.holder_name || "N/A"}</p>
              <p><span className="font-medium">GST:</span> {selectedSeller.gst || "N/A"}</p>
              <p><span className="font-medium">Commission %:</span> {selectedSeller.sales_commission_percentage || "N/A"}</p>
              <p><span className="font-medium">POS Status:</span> {selectedSeller.pos_status ? "Enabled" : "Disabled"}</p>
              <p><span className="font-medium">Min Order:</span> {selectedSeller.minimum_order_amount}</p>
              <p><span className="font-medium">Free Delivery:</span> {selectedSeller.free_delivery_status ? "Yes" : "No"}</p>
              <p><span className="font-medium">Free Delivery Over:</span> {selectedSeller.free_delivery_over_amount}</p>
            </div>

            <button
              onClick={() => setSelectedSeller(null)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;

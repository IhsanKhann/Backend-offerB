import React, { useState } from "react";
import api from "../../api/axios.js";
import { useNavigate } from "react-router-dom";

const DEMO = {
  sellers: {
    retail: "68ceed009f6641a93acc7b00",
    wholesale: "68ceed009f6641a93acc7b01",
    auction: "68ceed009f6641a93acc7b00",
    service: "68ceed009f6641a93acc7b01",
  },
  buyers: {
    retail: "68ceed409f6641a93acc7b05",
    wholesale: "68ceed409f6641a93acc7b06",
    auction: "68ceed409f6641a93acc7b05",
    service: "68ceed409f6641a93acc7b06",
  },
  orders: {
    retail: [
      { id: "68cef0409f6641a93acc7c10", name: "Retail Order 1" },
      { id: "68cef0409f6641a93acc7c14", name: "Retail Order 2" },
    ],
    wholesale: [
      { id: "68cef0409f6641a93acc7c11", name: "Wholesale Order 1" },
    ],
    auction: [
      { id: "68cef0409f6641a93acc7c12", name: "Auction Order 1" },
    ],
    service: [
      { id: "68cef0409f6641a93acc7c13", name: "Service Order 1" },
    ],
  },
};

const TYPES = ["retail", "wholesale", "auction", "service"];

const TransactionPanel = () => {
  const [activeTab, setActiveTab] = useState("transaction"); // "transaction" | "return"
  const [selectedType, setSelectedType] = useState("retail");
  const [customAmount, setCustomAmount] = useState(2500);
  const [selectedOrder, setSelectedOrder] = useState(DEMO.orders["retail"][0].id);
  const [lastResponse, setLastResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleTypeChange = (type) => {
    setSelectedType(type);
    setSelectedOrder(DEMO.orders[type]?.[0]?.id || "");
  };

  const sendTransaction = async (type) => {
    setLoading(true);
    setError(null);
    setLastResponse(null);

    const payload = {
      orderType: type,
      sellerId: DEMO.sellers[type],
      buyerId: DEMO.buyers[type],
      orderId: DEMO.orders[type][0].id,
      orderAmount: customAmount,
      actualAmount: customAmount,
    };

    try {
      const resp = await api.post("/transactions/order-process", payload);
      setLastResponse({ type: payload.orderType, data: resp.data });

      // Navigate to breakup page
      navigate(`/buyer-breakup/${payload.orderId}`, {
        state: { breakup: resp.data?.parentBreakup || resp.data?.breakup || null, orderId: payload.orderId },
      });
    } catch (err) {
      console.error("❌ Transaction error:", err);
      setError(err.response?.data?.error || "Error processing transaction");
    } finally {
      setLoading(false);
    }
  };

  const sendReturn = async () => {
    if (!selectedOrder) return;

    setLoading(true);
    setError(null);
    setLastResponse(null);

    const payload = {
      orderId: selectedOrder,
    };

    try {
      console.log("🛠️ Sending return request for order:", selectedOrder);
      const resp = await api.post("/transactions/return-process", payload);

      console.log("✅ Return response:", resp.data);

      setLastResponse({ type: "return", data: resp.data });
      alert("Return processed successfully!");

      navigate(`/buyer-breakup/${selectedOrder}`, {
        state: { breakup: resp.data.returnBreakup, orderId: selectedOrder },
      });
    } catch (err) {
      console.error("❌ Return error:", err);
      setError(err.response?.data?.error || "Error processing return");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center py-10 font-sans">
      <div className="w-full max-w-3xl bg-white shadow-lg rounded-lg p-8">
        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            className={`px-6 py-2 rounded-lg font-semibold ${
              activeTab === "transaction" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-800"
            }`}
            onClick={() => setActiveTab("transaction")}
          >
            Transaction Test
          </button>
          <button
            className={`px-6 py-2 rounded-lg font-semibold ${
              activeTab === "return" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-800"
            }`}
            onClick={() => setActiveTab("return")}
          >
            Return / Reversal
          </button>
        </div>

        {activeTab === "transaction" && (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-4 text-center">Transaction Test Panel</h1>
            <section className="mb-6 flex flex-col gap-4">
              <label className="text-lg font-semibold text-gray-700">Enter Order Amount:</label>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(parseFloat(e.target.value))}
                placeholder="Enter Amount"
                className="w-full max-w-xs px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </section>
            <section className="mb-6 flex flex-wrap justify-center gap-4">
              {TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => sendTransaction(type)}
                  disabled={loading}
                  className={`px-6 py-3 font-medium text-white rounded-lg shadow-lg transition transform hover:scale-105 ${
                    type === "retail"
                      ? "bg-green-600 hover:bg-green-700"
                      : type === "wholesale"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : type === "auction"
                      ? "bg-yellow-500 text-gray-800 hover:bg-yellow-600"
                      : "bg-purple-600 hover:bg-purple-700"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {loading && type === selectedType ? "Processing..." : `Send ${type.charAt(0).toUpperCase() + type.slice(1)} Order`}
                </button>
              ))}
            </section>
          </>
        )}

        {activeTab === "return" && (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-4 text-center">Return / Reversal Panel</h1>
            <section className="mb-6 flex flex-col gap-4">
              <label className="text-lg font-semibold text-gray-700">Select Order Type:</label>
              <select
                value={selectedType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </section>
            <section className="mb-6 flex flex-col gap-4">
              <label className="text-lg font-semibold text-gray-700">Select Specific Order:</label>
              <select
                value={selectedOrder}
                onChange={(e) => setSelectedOrder(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
              >
                {DEMO.orders[selectedType]?.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.name}
                  </option>
                ))}
              </select>
            </section>
            <button
              onClick={sendReturn}
              disabled={loading}
              className={`w-full px-6 py-3 bg-red-600 text-white font-medium rounded-lg shadow-lg hover:bg-red-700 transition transform hover:scale-105 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {loading ? "Processing Return..." : "Process Return / Reversal"}
            </button>
          </>
        )}

        {/* Response */}
        <section className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Response</h2>
          {error && <div className="text-red-600 font-semibold mb-2 p-3 bg-red-100 rounded-md">{error}</div>}
          {lastResponse ? (
            <pre className="bg-gray-200 p-4 rounded-md overflow-x-auto text-sm text-gray-800">
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          ) : (
            <div className="text-gray-500 text-sm p-4 text-center">No request sent yet.</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default TransactionPanel;

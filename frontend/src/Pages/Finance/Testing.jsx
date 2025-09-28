import React, { useState, useEffect } from "react";
import api from "../../api/axios.js";
import { useNavigate } from "react-router-dom";

const TransactionPanel = () => {
  const [activeTab, setActiveTab] = useState("transaction");
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [breakupRules, setBreakupRules] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedOrder, setSelectedOrder] = useState("");
  const [orders, setOrders] = useState({});
  const [customAmount, setCustomAmount] = useState(""); // ✅ new input field
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  // ✅ Fetch breakupRules
  useEffect(() => {
    const fetchBreakupRules = async () => {
      try {
        const resp = await api.get("/summaries/breakupRules");
        const allRules = resp.data || [];
        const orderRules = allRules.filter((r) => r.category === "order");
        setBreakupRules(orderRules);

        const types = orderRules.map((r) => r.transactionType);
        setTransactionTypes(types);
        if (types.length > 0) setSelectedType(types[0]);
      } catch (err) {
        console.error("❌ Error fetching breakupRules:", err);
      }
    };
    fetchBreakupRules();
  }, []);

  // ✅ Demo orders (replace with live fetch later)
  useEffect(() => {
    setOrders({
      retail: [
        {
          _id: "68cef0409f6641a93acc7c10",
          seller: "68ceed009f6641a93acc7b00",
          buyer: "68ceed409f6641a93acc7b05",
          transaction_type: "retail",
        },
      ],
      wholesale: [
        {
          _id: "68cef0409f6641a93acc7c11",
          seller: "68ceed009f6641a93acc7b01",
          buyer: "68ceed409f6641a93acc7b06",
          transaction_type: "wholesale",
        },
      ],
    });
  }, []);

  const handleTypeChange = (type) => {
    setSelectedType(type);
    setSelectedOrder(orders[type]?.[0]?._id || "");
  };

  // ✅ Order Processing with customAmount
  const sendTransaction = async (type) => {
    const order = orders[type]?.[0];
    if (!order || !customAmount) {
      setError("⚠️ Please select an order and enter an order amount.");
      return;
    }

    setLoading(true);
    setError(null);
    setLastResponse(null);

    const payload = {
      orderId: order._id,
      sellerId: order.seller,
      buyerId: order.buyer,
      orderType: order.transaction_type,
      orderAmount: parseFloat(customAmount), // ✅ use customAmount
    };

    console.log("🛠️ Sending Order Payload:", payload);

    try {
      const resp = await api.post("/transactions/order-process", payload);
      console.log("✅ Order response:", resp.data);
      setLastResponse({ type, data: resp.data });

      navigate(`/buyer-breakup/${order._id}`, {
        state: { breakup: resp.data?.parentBreakup || resp.data?.breakup, orderId: order._id },
      });
    } catch (err) {
      console.error("❌ Order error:", err);
      setError(err.response?.data?.error || "Error processing order");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Return Processing
  const sendReturn = async () => {
    if (!selectedOrder) return;

    setLoading(true);
    setError(null);
    setLastResponse(null);

    const payload = { orderId: selectedOrder };
    console.log("🔄 Sending Return Payload:", payload);

    try {
      const resp = await api.post("/transactions/return-process", payload);
      console.log("✅ Return response:", resp.data);
      setLastResponse({ type: "return", data: resp.data });

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

        {/* Transaction Panel */}
        {activeTab === "transaction" && (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-4 text-center">Transaction Test Panel</h1>

            {/* Input for custom amount */}
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Enter Order Amount:</label>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Enter custom amount"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>

            <section className="mb-6 flex flex-wrap justify-center gap-4">
              {transactionTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => sendTransaction(type)}
                  disabled={loading}
                  className={`px-6 py-3 font-medium text-white rounded-lg shadow-lg transition transform hover:scale-105
                    ${
                      type.includes("retail")
                        ? "bg-green-600 hover:bg-green-700"
                        : type.includes("wholesale")
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-purple-600 hover:bg-purple-700"
                    }
                    ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {loading && selectedType === type ? "Processing..." : `Send ${type}`}
                </button>
              ))}
            </section>
          </>
        )}

        {/* Return Panel */}
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
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
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
                {orders[selectedType]?.map((order) => (
                  <option key={order._id} value={order._id}>
                    {order._id}
                  </option>
                ))}
              </select>
            </section>
            <button
              onClick={sendReturn}
              disabled={loading}
              className={`w-full px-6 py-3 bg-red-600 text-white font-medium rounded-lg shadow-lg hover:bg-red-700 transition transform hover:scale-105 ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
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

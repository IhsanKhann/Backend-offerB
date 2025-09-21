// src/components/TransactionTestPanel.jsx
import React, { useState } from "react";
import api from "../../api/axios.js";

// ✅ Real MongoDB IDs wired in
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
    retail: "68cef0409f6641a93acc7c10",
    wholesale: "68cef0409f6641a93acc7c11",
    auction: "68cef0409f6641a93acc7c12",
    service: "68cef0409f6641a93acc7c13",
  },
};

// ✅ Consistent types
const TYPES = ["retail", "wholesale", "auction", "service"];

const TransactionTestPanel = () => {
  const [lastResponse, setLastResponse] = useState(null);
  const [error, setError] = useState(null);
  const [customAmount, setCustomAmount] = useState(2500);

  const sendTransaction = async (type) => {
    const payload = {
      orderType: type,
      sellerId: DEMO.sellers[type],
      buyerId: DEMO.buyers[type],
      orderId: DEMO.orders[type],
      orderAmount: customAmount,
      actualAmount: customAmount,
    };

    console.log("➡️ Sending payload:", payload);

    try {
      const resp = await api.post("/transactions/order-process", payload);
      setLastResponse({
        type,
        sentAmount: customAmount, // ✅ include the amount you sent
        data: resp.data,
      });
      setError(null);
    } catch (err) {
      console.error("❌ Axios error:", err);
      setLastResponse(null);
      setError(
        err.response?.data?.error || "Error from /transactions/order-process"
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center py-10 font-sans">
      <div className="w-full max-w-3xl bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Transaction Test Panel
        </h1>

        {/* Demo Data */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Demo Data (Seeded IDs)
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Seller ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Buyer ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Order ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {TYPES.map((type) => (
                  <tr key={type} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {type}
                    </td>
                    <td className="px-4 py-2 break-all text-xs text-gray-500">
                      {DEMO.sellers[type]}
                    </td>
                    <td className="px-4 py-2 break-all text-xs text-gray-500">
                      {DEMO.buyers[type]}
                    </td>
                    <td className="px-4 py-2 break-all text-xs text-gray-500">
                      {DEMO.orders[type]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <hr className="my-8 border-gray-300" />

        {/* Amount Input */}
        <section className="mb-8 flex flex-col items-center gap-4">
          <label
            htmlFor="amount"
            className="text-lg font-semibold text-gray-700"
          >
            Enter Order Amount:
          </label>
          <input
            id="amount"
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(parseFloat(e.target.value))}
            placeholder="Enter Amount"
            className="w-full max-w-xs px-4 py-2 text-center border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 transition"
          />
        </section>

        {/* Send Buttons */}
        <section className="mb-8 flex flex-wrap justify-center gap-4">
          {TYPES.map((type) => (
            <button
              key={type}
              onClick={() => sendTransaction(type)}
              className={`px-6 py-3 font-medium text-white rounded-lg shadow-lg transition transform hover:scale-105 ${
                type === "retail"
                  ? "bg-green-600 hover:bg-green-700"
                  : type === "wholesale"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : type === "auction"
                  ? "bg-yellow-500 text-gray-800 hover:bg-yellow-600"
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              Send Test {type.charAt(0).toUpperCase() + type.slice(1)} Order
            </button>
          ))}
        </section>

        <hr className="my-8 border-gray-300" />

        {/* API Response */}
        <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Response</h2>
          {error && (
            <div className="text-red-600 font-semibold mb-2 p-3 bg-red-100 rounded-md">
              Error: {error}
            </div>
          )}
          {lastResponse ? (
            <pre className="bg-gray-200 p-4 rounded-md overflow-x-auto text-sm text-gray-800">
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          ) : (
            <div className="text-gray-500 text-sm p-4 text-center">
              No transaction request sent yet.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default TransactionTestPanel;

// src/components/BuyerBreakupSummary.jsx
import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import api from "../../api/axios.js";

const BuyerBreakupSummary = () => {
  const { orderId: paramOrderId } = useParams();
  const location = useLocation();

  const [breakup, setBreakup] = useState(location.state?.breakup || null);
  const [orderId] = useState(location.state?.orderId || paramOrderId || null);
  const [loading, setLoading] = useState(!breakup);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!breakup && orderId) {
      const fetchBreakup = async () => {
        try {
          const resp = await api.get(`/transactions/order/${orderId}/breakup/buyer`);
          setBreakup(resp.data);
          setLoading(false);
        } catch (err) {
          console.error("❌ Error fetching buyer breakup:", err);
          setError("Could not fetch breakup summary");
          setLoading(false);
        }
      };
      fetchBreakup();
    }
  }, [orderId, breakup]);

  if (!orderId) {
    return (
      <div className="p-8 text-red-600">
        ❌ Missing order ID. Cannot load receipt.
      </div>
    );
  }

  if (loading) return <div className="p-8 text-gray-600">Loading receipt...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-10 font-sans">
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Payment Receipt
        </h1>

        <div className="mb-6 text-sm text-gray-600">
          <p><strong>Order ID:</strong> {breakup.orderId}</p>
          <p><strong>Buyer ID:</strong> {breakup.buyerId}</p>
          <p><strong>Seller ID:</strong> {breakup.sellerId}</p>
        </div>

        <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Component</th>
              <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Debit</th>
              <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {breakup.lines?.map((line, idx) => (
              <tr key={idx}>
                <td className="px-4 py-2 text-sm text-gray-800">{line.componentName}</td>
                <td className="px-4 py-2 text-sm text-right text-red-600">
                  {line.debit || 0}
                </td>
                <td className="px-4 py-2 text-sm text-right text-green-600">
                  {line.credit || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 text-right text-lg font-semibold text-gray-800">
          Total Paid: {breakup.totalDebit || 0}
        </div>
      </div>
    </div>
  );
};

export default BuyerBreakupSummary;

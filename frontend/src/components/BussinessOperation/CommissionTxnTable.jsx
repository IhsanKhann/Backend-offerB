import React, { useState } from "react";
import { CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

/* ===============================
   MAIN TABLE
================================ */
export default function CommissionTxnTable({ title, rows }) {
  const [openRow, setOpenRow] = useState(null);

  const toggleRow = (id) => {
    setOpenRow(openRow === id ? null : id);
  };

  const getStatusBadge = (tx) => {
    const { expiryReached, isReported } = tx.orderDetails || {};

    if (isReported) {
      return <Badge label="Settled" className="bg-green-100 text-green-700" icon={<CheckCircle size={14} />} />;
    }

    if (expiryReached) {
      return <Badge label="Ready" className="bg-orange-100 text-orange-700" icon={<AlertTriangle size={14} />} />;
    }

    return <Badge label="Waiting" className="bg-blue-100 text-blue-700" icon={<Clock size={14} />} />;
  };

  return (
    <div className="bg-white rounded-xl shadow">
      {/* Header */}
      <div className="px-5 py-4 border-b">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      {rows.length === 0 ? (
        <div className="p-6 text-center text-gray-500">No transactions found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-right">Order Amount</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center"></th>
              </tr>
            </thead>

            <tbody>
              {rows.map(tx => {
                const isOpen = openRow === tx._id;

                return (
                  <React.Fragment key={tx._id}>
                    {/* MAIN ROW */}
                    <tr className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {formatDate(tx.date)}
                      </td>

                      <td className="px-4 py-3 font-mono text-xs">
                        {tx.orderDetails?.orderId || "—"}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {formatAmount(tx.amount)}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">
                        {formatAmount(tx.commissionAmount)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(tx)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleRow(tx._id)}>
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>

                    {/* EXPANDED COMMISSION DETAILS */}
                    {isOpen && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-4">
                          <CommissionDetails details={tx.commissionDetails} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ===============================
   COMMISSION BREAKDOWN
================================ */
function CommissionDetails({ details = [] }) {
  if (details.length === 0) {
    return <p className="text-sm text-gray-500">No commission breakdown</p>;
  }

  return (
    <div className="max-w-md">
      <h4 className="text-sm font-semibold mb-2">Commission Breakdown</h4>

      <div className="space-y-1 text-sm">
        {details.map(item => (
          <div key={item._id} className="flex justify-between">
            <span className="text-gray-600">{item.componentName}</span>
            <span className="font-medium">
              {formatAmount(item.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===============================
   BADGE
================================ */
function Badge({ label, icon, className }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${className}`}>
      {icon}
      {label}
    </span>
  );
}

/* ===============================
   FORMATTERS (Decimal128 SAFE)
================================ */
function formatAmount(val) {
  if (!val) return "0";

  if (typeof val === "object" && "$numberDecimal" in val) {
    return Number(val.$numberDecimal).toLocaleString();
  }

  if (typeof val === "object" && val.toString) {
    return Number(val.toString()).toLocaleString();
  }

  return Number(val).toLocaleString();
}

function formatDate(date) {
  if (!date) return "—";
  if (typeof date === "object" && "$date" in date) {
    return new Date(date.$date).toLocaleDateString();
  }
  return new Date(date).toLocaleDateString();
}

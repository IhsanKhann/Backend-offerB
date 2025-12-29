import React, { useState } from "react";

export default function CloseCommissionOnlyModal({
  onClose,
  onConfirm,
  loading
}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const periodKey =
    fromDate && toDate ? fromDate.slice(0, 7) : "";

  const handleSubmit = () => {
    if (!fromDate || !toDate) {
      alert("Please select both dates");
      return;
    }

    onConfirm({
      fromDate,
      toDate,
      periodKey
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          Close Commission (No Expenses)
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {periodKey && (
            <div className="text-sm text-gray-500">
              Period Key: <strong>{periodKey}</strong>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-black text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Closing..." : "Close Commission"}
          </button>
        </div>
      </div>
    </div>
  );
}

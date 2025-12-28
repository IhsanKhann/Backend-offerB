import React, { useState } from "react";
import api from "../../api/axios.js";

export default function CloseCommissionModal({ onClose, onSuccess }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [periodKey, setPeriodKey] = useState("");
  const [loading, setLoading] = useState(false);

  const closeCommission = async () => {
    setLoading(true);
    try {
      await api.post("/commissionReports/cyclicReports", {
        periodKey,
        fromDate,
        toDate
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-[420px]">
        <h2 className="text-lg font-semibold mb-4">
          Close Commission Period
        </h2>

        <div className="space-y-3">
          <input
            placeholder="Period Key (e.g. 2025-01)"
            className="input"
            value={periodKey}
            onChange={e => setPeriodKey(e.target.value)}
          />
          <input type="date" className="input" value={fromDate}
            onChange={e => setFromDate(e.target.value)} />
          <input type="date" className="input" value={toDate}
            onChange={e => setToDate(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={closeCommission}
            className="px-4 py-2 bg-black text-white rounded"
          >
            {loading ? "Closing..." : "Close Commission"}
          </button>
        </div>
      </div>
    </div>
  );
}

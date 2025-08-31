// src/components/BlockModal.jsx
import React, { useState } from "react";
import api from "../api/axios";

const BlockModal = ({ isOpen, onClose, employee, refreshEmployees }) => {
  const [blockStartDate, setBlockStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [blockEndDate, setBlockEndDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  if (!isOpen || !employee) return null;

  const handleBlock = async () => {
    try {
      await api.post(`/finalizedEmployees/block/${employee._id}`, {
        blockReason,
        blockStartDate,
        blockEndDate,
      });
      await refreshEmployees();
      onClose();
    } catch (err) {
      console.error("Error blocking employee:", err);
      alert("Failed to block employee.");
    }
  };

  const handleRestore = async () => {
    try {
      await api.patch(`/finalizedEmployees/restore-block/${employee._id}`);
      await refreshEmployees();
      onClose();
    } catch (err) {
      console.error("Error restoring block:", err);
      alert("Failed to restore employee from block.");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-[400px] relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
        >
          ✖
        </button>

        <h2 className="text-xl font-bold mb-4">
          {employee?.profileStatus?.decision === "Blocked"
            ? "Restore Employee"
            : "Block Employee"}
        </h2>

        {employee?.profileStatus?.decision !== "Blocked" && (
          <>
            <label className="block mb-2">
              Block Start Date:
              <input
                type="date"
                className="border rounded px-2 py-1 w-full"
                value={blockStartDate}
                onChange={(e) => setBlockStartDate(e.target.value)}
              />
            </label>

            <label className="block mb-2">
              Block End Date (optional):
              <input
                type="date"
                className="border rounded px-2 py-1 w-full"
                value={blockEndDate}
                onChange={(e) => setBlockEndDate(e.target.value)}
              />
            </label>

            <label className="block mb-4">
              Reason:
              <textarea
                className="border rounded px-2 py-1 w-full"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </label>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button
            className="bg-gray-400 text-white px-3 py-1 rounded"
            onClick={onClose}
          >
            Cancel
          </button>

          {employee?.profileStatus?.decision === "Blocked" ? (
            <button
              className="bg-green-600 text-white px-3 py-1 rounded"
              onClick={handleRestore}
            >
              Yes, Restore
            </button>
          ) : (
            <button
              className="bg-red-600 text-white px-3 py-1 rounded"
              onClick={handleBlock}
            >
              Block
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockModal;

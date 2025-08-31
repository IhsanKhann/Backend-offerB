// src/components/SuspendModal.jsx
import React, { useState } from "react";
import api from "../api/axios";

const SuspendModal = ({ isOpen, onClose, employee, refreshEmployees }) => {
  const [suspensionReason, setSuspensionReason] = useState("");
  const [suspensionEndDate, setSuspensionEndDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  if (!isOpen || !employee) return null;

  const handleSuspend = async () => {
    try {
      await api.post(`/finalizedEmployees/suspend/${employee._id}`, {
        suspensionReason,
        suspensionStartDate: new Date().toISOString().slice(0, 10), // today
        suspensionEndDate,
      });
      await refreshEmployees();
      onClose();
    } catch (err) {
      console.error("Error suspending:", err);
      alert("Failed to suspend employee.");
    }
  };

  const handleRestore = async () => {
    try {
      await api.patch(`/finalizedEmployees/restore-suspension/${employee._id}`);
      await refreshEmployees();
      onClose();
    } catch (err) {
      console.error("Error restoring suspension:", err);
      alert("Failed to restore suspension.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-96 p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
        >
          ✖
        </button>

        <h2 className="text-xl font-bold mb-4">
          {employee?.profileStatus?.decision === "Suspended"
            ? "Restore Suspension"
            : "Suspend Employee"}
        </h2>

        {/* Suspension Form */}
        {employee?.profileStatus?.decision !== "Suspended" && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Suspension Reason
              </label>
              <textarea
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="Enter reason for suspension"
                className="w-full border p-2 rounded-md"
                rows={3}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Suspension End Date
              </label>
              <input
                type="date"
                value={suspensionEndDate}
                onChange={(e) => setSuspensionEndDate(e.target.value)}
                className="w-full border p-2 rounded-md"
              />
            </div>
          </>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded-md bg-gray-200"
            onClick={onClose}
          >
            Cancel
          </button>

          {employee?.profileStatus?.decision === "Suspended" ? (
            <button
              className="px-4 py-2 rounded-md bg-green-600 text-white"
              onClick={handleRestore}
            >
              Restore
            </button>
          ) : (
            <button
              className="px-4 py-2 rounded-md bg-red-600 text-white"
              onClick={handleSuspend}
              disabled={!suspensionReason}
            >
              Suspend
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuspendModal;

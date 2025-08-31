import React, { useState } from "react";
import { X } from "lucide-react";

const TerminateModal = ({ isOpen, onClose, onConfirm, employee }) => {
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  if (!isOpen) return null;

  const isTerminated = employee?.profileStatus?.decision === "Terminated";

  const handleSubmit = () => {
    if (!isTerminated && (!reason || !startDate || !endDate)) {
      alert("Please fill all fields");
      return;
    }
    onConfirm(isTerminated ? "restore" : "terminate", {
      reason,
      startDate,
      endDate,
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-2xl shadow-lg w-[400px]">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-red-600">
            {isTerminated ? "Restore Termination" : "Terminate Employee"}
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-600 hover:text-black" />
          </button>
        </div>

        {!isTerminated ? (
          <>
            <p className="text-gray-700 mb-4">
              Provide details to{" "}
              <span className="font-bold">terminate</span>{" "}
              {employee?.individualName || "this employee"}.
            </p>
            <input
              type="text"
              placeholder="Termination Reason"
              className="border w-full p-2 rounded mb-3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <label className="text-xs text-gray-600">Start Date</label>
            <input
              type="date"
              className="border w-full p-2 rounded mb-3"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <label className="text-xs text-gray-600">End Date</label>
            <input
              type="date"
              className="border w-full p-2 rounded mb-4"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </>
        ) : (
          <p className="text-gray-700 mb-4">
            Do you want to <span className="font-bold">restore</span>{" "}
            {employee?.individualName || "this employee"} from termination?
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={`px-4 py-2 text-white rounded-lg ${
              isTerminated
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isTerminated ? "Restore" : "Terminate"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TerminateModal;

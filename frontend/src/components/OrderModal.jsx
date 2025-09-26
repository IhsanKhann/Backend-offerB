// OrderBreakupModal.jsx
import React from "react";

const OrderBreakupModal = ({ order, isOpen, onClose }) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">Order Breakup</h2>
        <p className="text-gray-600 mb-2">Order ID: {order._id}</p>
        <p className="text-gray-600 mb-4">Buyer: {order.buyerName || "N/A"}</p>

        {order.breakupFiles?.length ? (
          <div className="space-y-2">
            {order.breakupFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex justify-between border-b pb-2 text-sm"
              >
                <span>{file.componentName}</span>
                <span>PKR {file.amount?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No breakup files available</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderBreakupModal;

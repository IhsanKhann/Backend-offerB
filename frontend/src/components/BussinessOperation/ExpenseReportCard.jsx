import React from "react";

const ExpenseReportCard = ({ report, onView }) => {
  return (
    <div className="w-[350px] bg-white rounded-xl shadow hover:shadow-xl transition-all p-5 flex flex-col justify-between">
      
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          Expense Report
        </h3>

        <p className="text-sm text-gray-500 break-all">
          {report.periodKey}
        </p>

        <p className="mt-3 text-gray-700">
          <span className="font-semibold">Total:</span>{" "}
          ${Number(report.totalAmount).toFixed(2)}
        </p>

        <p className="text-gray-700">
          <span className="font-semibold">Status:</span>{" "}
          {report.status}
        </p>
      </div>

      <button
        onClick={onView}
        className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg"
      >
        View Transactions
      </button>
    </div>
  );
};

export default ExpenseReportCard;

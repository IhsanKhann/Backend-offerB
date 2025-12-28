import React from "react";

const ExpenseTransactionCard = ({ txn }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="w-full border rounded-xl bg-white shadow-sm">
      <div
        className="p-4 flex justify-between cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div>
          <p className="font-semibold">{txn.description}</p>
          <p className="text-sm text-gray-500">
            {new Date(txn.date).toLocaleDateString()}
          </p>
        </div>

        <p className="font-bold text-red-600">
          ${Number(txn.amount).toFixed(2)}
        </p>
      </div>

      {open && (
        <div className="px-4 pb-4 text-sm text-gray-600">
          <p>Reported: {txn.expenseDetails?.includedInPnL ? "Yes" : "No"}</p>
          <p>Paid: {txn.expenseDetails?.isPaid ? "Yes" : "No"}</p>
        </div>
      )}
    </div>
  );
};

export default ExpenseTransactionCard;

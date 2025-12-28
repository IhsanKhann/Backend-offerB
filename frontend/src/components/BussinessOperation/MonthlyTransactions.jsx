import ExpenseTransactionCard from "./ExpenseTransactionCard";

const MonthlyTransactions = ({ monthData }) => {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="text-xl font-bold mb-4">
        {monthData.month}
      </h2>

      <div className="space-y-3">
        {monthData.transactions.map(txn => (
          <ExpenseTransactionCard
            key={txn._id}
            txn={txn}
          />
        ))}
      </div>
    </div>
  );
};

export default MonthlyTransactions;

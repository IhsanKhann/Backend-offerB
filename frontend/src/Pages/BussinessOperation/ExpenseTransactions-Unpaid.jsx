// pages/ExpenseTransactions/UnpaidExpenses.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import Sidebar from "../../components/Sidebar.jsx";
import { FileText, CreditCard, Calendar, Layers } from "lucide-react";

const UnpaidExpenses = () => {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    api.get("/expenseReports/fetchExpenseTransactionsController", {
      params: { isPaid: false }
    }).then(res => {
      setTransactions(res.data.transactions || []);
    });
  }, []);

 const navItems = [
     { name: "All Summaries", path: "/summary-table", icon: <Layers size={18} /> },
       { name: "Expenses Dashboard", path: "/expenseDashboard", icon: <Layers size={18} /> },
     { name: "Commission Dashboard", path: "/commission-dashboard", icon: <CreditCard size={18} /> },
     { name: "Calculated Reports", path: "/expenseDashboard/CalculatedExpenseReports", icon: <FileText size={18} /> },
     { name: "Paid Reports", path: "/expenseDashboard/PaidExpenseReports", icon: <FileText size={18} /> },
     { name: "Paid Expenses", path: "/expenseDashboard/PaidExpenses", icon: <Calendar size={18} /> },
     { name: "UnPaid Expenses", path: "/expenseDashboard/UnpaidExpenses", icon: <Calendar size={18} /> }
];
    
  return (
    <div className="flex bg-gray-100 min-h-screen">
      <Sidebar title="Expense Panel" navItems={navItems} />

      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold mb-6">Unpaid Expenses</h1>
        
        {transactions.length === 0 && <p class="bold text-xl"> No UnPaid Expense Transactions</p>}
        
        <div className="space-y-4">
          {transactions.map(txn => (
            <div key={txn._id} className="bg-white p-4 rounded shadow">
              <p><strong>Date:</strong> {new Date(txn.date).toLocaleDateString()}</p>
              <p><strong>Description:</strong> {txn.description}</p>
              <p className="text-red-600 font-semibold">
                Amount: {txn.amount.$numberDecimal}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default UnpaidExpenses;

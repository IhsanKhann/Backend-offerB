import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import Sidebar from "../../components/Sidebar.jsx";
import { FileText, CreditCard, Calendar, Layers } from "lucide-react";

import GenerateExpenseForm from "../../components/BussinessOperation/GenerateExpenseForm.jsx";
import MonthlyTransactions from "../../components/BussinessOperation/MonthlyTransactions.jsx";

const ExpenseDashboard = () => {
  const [unreportedMonths, setUnreportedMonths] = useState([]);
  const [reportedMonths, setReportedMonths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null); // NEW

  /* ===============================
     FETCH & GROUP TRANSACTIONS
  =============================== */
  const fetchGroupedTransactions = async () => {
    console.log("📡 Fetching grouped expense transactions...");
    try {
      setLoading(true);

      const res = await api.get("/expenseReports/groupExpenseTransactions");
      console.log("✅ Raw backend response:", res.data);

      if (res.data) {
        setUnreportedMonths(
          Array.isArray(res.data.unreportedMonths) ? res.data.unreportedMonths : []
        );
        setReportedMonths(
          Array.isArray(res.data.reportedMonths) ? res.data.reportedMonths : []
        );
      }
    } catch (err) {
      console.error("❌ Error fetching grouped transactions:", err);
      setUnreportedMonths([]);
      setReportedMonths([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupedTransactions();
  }, []);

 const navItems = [
     { name: "All Summaries", path: "/summary-table", icon: <Layers size={18} /> },
       { name: "Expenses Dashboard", path: "/expenseDashboard", icon: <Layers size={18} /> },
     { name: "Commission Dashboard", path: "/commissionDashboard", icon: <CreditCard size={18} /> },
     { name: "Calculated Reports", path: "/expenseDashboard/CalculatedExpenseReports", icon: <FileText size={18} /> },
     { name: "Paid Reports", path: "/expenseDashboard/PaidExpenseReports", icon: <FileText size={18} /> },
     { name: "Paid Expenses", path: "/expenseDashboard/PaidExpenses", icon: <Calendar size={18} /> },
     { name: "UnPaid Expenses", path: "/expenseDashboard/UnpaidExpenses", icon: <Calendar size={18} /> }
];
 
  
  return (
    <div className="flex bg-gray-100 min-h-screen">
      <div className="sticky top-0 h-screen">
        <Sidebar title="Expense Panel" navItems={navItems} />
      </div>

      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6">Expense Dashboard</h1>

        {/* ===============================
            GENERATE FORM
        =============================== */}
        <GenerateExpenseForm refresh={fetchGroupedTransactions} />

        {/* ===============================
            TWO COLUMN TRANSACTIONS
        =============================== */}
        <div className="mt-10 grid grid-cols-2 gap-6">
          {/* UNREPORTED TRANSACTIONS */}
          <div className="bg-gray-50 p-4 rounded shadow-md max-h-[70vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Unreported Transactions</h2>
            {loading && <p className="text-gray-500">Loading...</p>}
            {!loading && unreportedMonths.length === 0 && (
              <p className="text-gray-500">No unreported transactions.</p>
            )}
            {!loading && unreportedMonths.length > 0 && (
              <div className="space-y-4">
                {unreportedMonths.map((monthObj) => (
                  <div
                    key={monthObj.month}
                    className="cursor-pointer p-3 border rounded hover:bg-gray-200"
                    onClick={() => setSelectedMonth(monthObj)}
                  >
                    <p className="font-medium">{monthObj.month}</p>
                    <p className="text-gray-500">{monthObj.transactions.length} transactions</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* REPORTED TRANSACTIONS */}
          <div className="bg-gray-100 p-4 rounded shadow-md max-h-[70vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Reported Transactions</h2>
            {loading && <p className="text-gray-500">Loading...</p>}
            {!loading && reportedMonths.length === 0 && (
              <p className="text-gray-500">No reported transactions.</p>
            )}
            {!loading && reportedMonths.length > 0 && (
              <div className="space-y-4">
                {reportedMonths.map((monthObj) => (
                  <div
                    key={monthObj.month}
                    className="cursor-pointer p-3 border rounded hover:bg-gray-200"
                    onClick={() => setSelectedMonth(monthObj)}
                  >
                    <p className="font-medium">{monthObj.month}</p>
                    <p className="text-gray-500">{monthObj.transactions.length} transactions</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===============================
            SELECTED MONTH TRANSACTIONS
        =============================== */}
        {selectedMonth && (
          <div className="mt-10 bg-white p-4 rounded shadow-md">
            <h2 className="text-xl font-semibold mb-4">
              Transactions for {selectedMonth.month}
            </h2>
            <div className="space-y-4">
              {selectedMonth.transactions.map((txn) => (
                <div key={txn._id} className="p-3 border rounded bg-gray-50">
                  <p><strong>Date:</strong> {new Date(txn.date).toLocaleDateString()}</p>
                  <p><strong>Description:</strong> {txn.description}</p>
                  <p><strong>Amount:</strong> {txn.amount.$numberDecimal}</p>
                  <p><strong>Status:</strong> {txn.status}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ExpenseDashboard;

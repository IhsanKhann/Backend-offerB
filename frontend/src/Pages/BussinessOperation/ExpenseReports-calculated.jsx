// pages/ExpenseReports/CalculatedExpenseReports.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import Sidebar from "../../components/Sidebar.jsx";
import { FileText, CreditCard, Calendar, Layers } from "lucide-react";

const CalculatedExpenseReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get("/expenseReports/fetchExpenseReportsController", {
        params: { status: "calculated" }
      });
      setReports(res.data.reports || []);
    } catch (err) {
      console.error(err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
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
      <div className="sticky top-0 h-screen">
        <Sidebar title="Expense Panel" navItems={navItems} />
      </div>

      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6">Calculated Expense Reports</h1>

        {loading && <p>Loading...</p>}
        {!loading && reports.length === 0 && <p>No calculated reports.</p>}

        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report._id} className="bg-white p-4 rounded shadow">
              <p><strong>Period:</strong> {report.periodKey}</p>
              <p><strong>Total:</strong> {report.totalAmount?.$numberDecimal}</p>
              <p><strong>Status:</strong> {report.status}</p>
              <p className="text-gray-500">
                Transactions: {report.transactionIds?.length || 0}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default CalculatedExpenseReports;


// pages/ExpenseReports/PaidExpenseReports.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import Sidebar from "../../components/Sidebar.jsx";
import { FileText, CreditCard, Calendar, Layers } from "lucide-react";

const PaidExpenseReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const res = await api.get("/expenseReports/fetchExpenseReportsController", {
          params: { status: "paid" }
        });
        setReports(res.data.reports || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

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

      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold mb-6">Paid Expense Reports</h1>

        {loading && <p>Loading...</p>}
        {!loading && reports.length === 0 && <p>No paid reports.</p>}

        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report._id} className="bg-white p-4 rounded shadow">
              <p><strong>Period:</strong> {report.periodKey}</p>
              <p><strong>Total Paid:</strong> {report.totalAmount?.$numberDecimal}</p>
              <p className="text-green-600 font-semibold">Settled</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default PaidExpenseReports;

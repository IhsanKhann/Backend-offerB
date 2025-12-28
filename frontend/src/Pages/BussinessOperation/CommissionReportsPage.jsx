import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import Sidebar from "../../components/Sidebar";
import CommissionReportCard from "../../components/BussinessOperation/CommissionReportCard.jsx";
import { Layers, CreditCard, FileText, List } from "lucide-react";

 const navItems = [
    {
      name: "Commission Dashboard",
      path: "/commissionDashboard",
      icon: <CreditCard size={18} />
    },
    {
      name: "Commission Reports",
      path: "/commissionDashboard/Reports",
      icon: <FileText size={18} />
    },
    {
      name: "Commission Transactions",
      path: "/commissionDashboard/Transactions",
      icon: <List size={18} />
    }
];

export default function CommissionReports() {
  const [reports, setReports] = useState(null);

  useEffect(() => {
    api.get("/commissionReports/fetchReportsByStatus")
      .then(res => setReports(res.data));
  }, []);

  if (!reports) return null;
  
  return (
    <div className="flex">
      
      <Sidebar navItems={navItems} title="CommissionDashboard"/>

      <div className="flex-1 p-6 space-y-4">
        <h2 className="text-xl font-semibold">Locked Reports</h2>
        {reports.locked.map(r => (
          <CommissionReportCard key={r._id} report={r} />
        ))}

        <h2 className="text-xl font-semibold mt-6">Settled Reports</h2>
        {reports.settled.map(r => (
          <CommissionReportCard key={r._id} report={r} />
        ))}
      </div>
    </div>
  );
}

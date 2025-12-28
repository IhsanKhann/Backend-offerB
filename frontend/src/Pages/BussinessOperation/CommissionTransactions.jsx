import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import Sidebar from "../../components/Sidebar";
import CommissionTxnTable from "../../components/BussinessOperation/CommissionTxnTable";
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

export default function CommissionTransactions() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/commissionReports/fetchTransactionsByStatus")
      .then(res => setData(res.data));
  }, []);

  if (!data) return null;

  return (
    <div className="flex">
      <Sidebar navItems={navItems} title="CommissionDashboard"/>
      <div className="flex-1 p-6 space-y-6">
        <CommissionTxnTable title="Ready for Commission" rows={data.readyForCommission} />
        <CommissionTxnTable title="Waiting for Return" rows={data.waitingForReturn} />
        <CommissionTxnTable title="Settled" rows={data.settled} />
      </div>
    </div>
  );
}
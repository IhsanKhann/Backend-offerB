import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import Sidebar from "../../components/Sidebar";
import CommissionMonthCard from "../../components/BussinessOperation/CommissionMonthCard.jsx";
import CloseCommissionModal from "../../components/BussinessOperation/CloseCommissionModal.jsx";
import { Layers, CreditCard, FileText, List } from "lucide-react";

export default function CommissionDashboard() {
  const [months, setMonths] = useState([]);
  const [openCloseModal, setOpenCloseModal] = useState(false);

  const fetchGrouped = async () => {
    const res = await api.get("/commissionReports/groupTransactionsForCommission");
    setMonths(res.data.months || []);
  };

  useEffect(() => {
    fetchGrouped();
  }, []);

  /* ===============================
     LOCAL SIDEBAR NAV (COMMISSION)
  =============================== */
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

  return (
    <div className="flex">
      {/* 👇 LOCAL NAV PASSED HERE */}
      <Sidebar navItems={navItems} title="CommissionDashboard"/>

      <div className="flex-1 p-6 bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Layers /> Commission Dashboard
          </h1>

          <button
            onClick={() => setOpenCloseModal(true)}
            className="px-4 py-2 bg-black text-white rounded-lg"
          >
            Close Commission
          </button>
        </div>

        {/* Monthly Cards */}
        <div className="space-y-4">
          {months.map(month => (
            <CommissionMonthCard key={month.month} data={month} />
          ))}
        </div>

        {openCloseModal && (
          <CloseCommissionModal
            onClose={() => setOpenCloseModal(false)}
            onSuccess={fetchGrouped}
          />
        )}
      </div>
    </div>
  );
}

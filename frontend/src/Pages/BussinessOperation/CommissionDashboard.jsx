import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import Sidebar from "../../components/Sidebar";

import CommissionMonthCard from "../../components/BussinessOperation/CommissionMonthCard.jsx";
import CloseCommissionModal from "../../components/BussinessOperation/CloseCommissionModal.jsx";
import CloseCommissionOnlyModal from "../../components/BussinessOperation/CloseCommissionOnlyModal.jsx";

import { Layers, CreditCard, FileText, List } from "lucide-react";

export default function CommissionDashboard() {
  const [months, setMonths] = useState([]);
  const [openCloseModal, setOpenCloseModal] = useState(false);
  const [openNoExpenseModal, setOpenNoExpenseModal] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ===============================
     FETCH MONTHLY GROUPED DATA
  =============================== */
  const fetchGrouped = async () => {
    try {
      const res = await api.get(
        "/commissionReports/groupTransactionsForCommission"
      );
      setMonths(res.data.months || []);
    } catch (err) {
      console.error(err);
      alert("Failed to load commission data");
    }
  };

  useEffect(() => {
    fetchGrouped();
  }, []);

  /* ===============================
     CLOSE COMMISSION (NO EXPENSE)
  =============================== */
  const closeCommissionOnly = async ({ fromDate, toDate, periodKey }) => {
    setLoading(true);
    try {
      await api.post("/commissionReports/directlyNoExpanses", {
        fromDate,
        toDate,
        periodKey
      });

      await fetchGrouped();
      alert("Commission closed successfully");
      setOpenNoExpenseModal(false);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to close commission");
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     LOCAL SIDEBAR NAV
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
      <Sidebar navItems={navItems} title="Commission Dashboard" />

      <div className="flex-1 p-6 bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Layers /> Commission Dashboard
          </h1>

          <div className="flex gap-3">
            <button
              onClick={() => setOpenCloseModal(true)}
              className="px-4 py-2 bg-black text-white rounded-lg"
            >
              Close Commission
            </button>

            <button
              onClick={() => setOpenNoExpenseModal(true)}
              className="px-4 py-2 bg-black text-white rounded-lg"
            >
              Close Commission (No Expenses)
            </button>
          </div>
        </div>

        {/* Monthly Cards */}
        <div className="space-y-4">
          {months.length ? (
            months.map(month => (
              <CommissionMonthCard
                key={month.periodKey || month.month}
                data={month}
              />
            ))
          ) : (
            <p className="text-gray-500">No commission data available</p>
          )}
        </div>

        {/* NO EXPENSE MODAL */}
        {openNoExpenseModal && (
          <CloseCommissionOnlyModal
            loading={loading}
            onClose={() => setOpenNoExpenseModal(false)}
            onConfirm={closeCommissionOnly}
          />
        )}

        {/* NORMAL COMMISSION MODAL */}
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

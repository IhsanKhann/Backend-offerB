// SalaryHistoryPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar.jsx";
import api from "../../api/axios.js";

const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

const formatRupees = (amt) => `PKR ${Number(amt || 0).toLocaleString()}`;

const SalaryHistoryPage = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [breakups, setBreakups] = useState([]);
  const [expandedCard, setExpandedCard] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get(`/summaries/salary/breakups/${employeeId}`);
        setBreakups(res.data.breakups || []);
      } catch (err) {
        console.error("Error loading salary history", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [employeeId]);

  const navItems = [
    { name: "Salary Dashboard", path: "/salary-dashboard" },
    { name: "All Summaries", path: "/summary-table" },
    { name: "All Tables", path: "/tables" },
    { name: "Testing", path: "/paymentDashboard" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="sticky top-0 h-screen">
        <Sidebar navItems={navItems} title="Salary History" />
      </div>

      <div className="flex-1 p-6">
        <button
          onClick={() => navigate(-1)}
          className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md mb-4"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold mb-4">Salary History</h1>

        {loading ? (
          <Loader />
        ) : breakups.length === 0 ? (
          <p className="text-gray-500 text-center py-6">No salary breakups found.</p>
        ) : (
          <div className="space-y-3">
            {breakups.map((b, i) => {
              const isExpanded = expandedCard === i;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 shadow-sm bg-white hover:shadow-md transition cursor-pointer"
                >
                  {/* Card Header */}
                  <div
                    className="flex justify-between items-center p-4"
                    onClick={() => setExpandedCard(isExpanded ? null : i)}
                  >
                    <div>
                      <p className="text-sm font-medium text-blue-700">
                        Paid For: {b.paidFor || `${b.month} ${b.year}`}
                      </p>
                      <p className="text-xs text-gray-600">
                        Paid On: {b.paidOnDate} {b.paidOnTime}
                      </p>
                      <p className="text-xs text-gray-600">
                        Net Salary: {formatRupees(b.netSalary)}
                      </p>
                    </div>
                    <div className="text-gray-500">{isExpanded ? "▲" : "▼"}</div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-200 text-xs text-gray-700 space-y-2">
                      <p>
                        Employee: {b.employeeId?.individualName || "N/A"} ({b.employeeId?.UserId})
                      </p>
                      <p>Role: {b.roleId?.roleName || "N/A"}</p>
                      <p>Salary Type: {b.salaryRules?.salaryType ?? "N/A"}</p>

                      {b.salaryRules?.terminalBenefits?.length > 0 && (
                        <>
                          <p className="font-medium mt-2">Terminal Benefits:</p>
                          {b.salaryRules.terminalBenefits.map((t, idx) => (
                            <p key={idx}>
                              {t.name} ({t.type}): {formatRupees(t.value)}
                            </p>
                          ))}
                        </>
                      )}

                      {b.salaryRules?.allowances?.length > 0 && (
                        <>
                          <p className="font-medium mt-2">Allowances:</p>
                          {b.salaryRules.allowances.map((a, idx) => (
                            <p key={idx}>
                              {a.name} ({a.type}): {formatRupees(a.value)}
                            </p>
                          ))}
                        </>
                      )}

                      {b.salaryRules?.deductions?.length > 0 && (
                        <>
                          <p className="font-medium mt-2">Deductions:</p>
                          {b.salaryRules.deductions.map((d, idx) => (
                            <p key={idx}>
                              {d.name} ({d.type}): {formatRupees(d.value)}
                            </p>
                          ))}
                        </>
                      )}

                      {b.calculatedBreakup && (
                        <>
                          <p className="font-medium mt-2">Calculated Breakup:</p>
                          <p>Total Allowances: {formatRupees(b.calculatedBreakup.totalAllowances)}</p>
                          <p>Total Deductions: {formatRupees(b.calculatedBreakup.totalDeductions)}</p>
                          <p>Net Salary: {formatRupees(b.calculatedBreakup.netSalary)}</p>

                          {b.calculatedBreakup.breakdown?.length > 0 && (
                            <>
                              <p className="font-medium mt-1">Breakdown:</p>
                              {b.calculatedBreakup.breakdown.map((bd, idx) => (
                                <p key={idx}>
                                  {bd.name} ({bd.category}): {formatRupees(bd.value)}{" "}
                                  {bd.excludeFromTotals ? "(Excluded)" : ""}
                                </p>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SalaryHistoryPage;

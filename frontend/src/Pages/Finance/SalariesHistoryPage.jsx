// SalaryHistoryPage.jsx
import React, { useEffect, useState, useRef } from "react";
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
  const [dropdownOpen, setDropdownOpen] = useState(null);
  const dropdownRefs = useRef({});

  // Fetch salary history
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

  // Close dropdowns if clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      Object.keys(dropdownRefs.current).forEach((key) => {
        if (dropdownRefs.current[key] && !dropdownRefs.current[key].contains(e.target)) {
          setDropdownOpen(null);
        }
      });
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDeleteBreakup = async (breakupId) => {
    if (window.confirm("Are you sure you want to delete this breakup?")) {
      try {
        const res = await api.delete(`/summaries/salary/breakup/${breakupId}`);
        if (res.data?.success) {
          setBreakups((prev) => prev.filter((b) => b._id !== breakupId));
          alert("Breakup deleted successfully!");
        } else {
          alert(res.data?.message || "Failed to delete breakup");
        }
      } catch (err) {
        console.error(err);
        alert("Error deleting breakup");
      }
    }
  };

  const navItems = [
    { name: "Salary Dashboard", path: "/salary-dashboard" },
    { name: "All Summaries", path: "/summary-table" },
    { name: "All Tables", path: "/tables" },
    { name: "Testing", path: "/paymentDashboard" },
  ];

  // Dropdown actions are scalable: just add more here
  const actions = [
    { name: "Delete Breakup", action: handleDeleteBreakup, color: "text-red-600" },
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
          <div className="space-y-4">
            {breakups.map((b, i) => {
              const isExpanded = expandedCard === i;
              const isDropdownOpen = dropdownOpen === i;

              return (
                <div
                  key={b._id}
                  className="rounded-xl border border-gray-200 shadow-sm bg-white hover:shadow-md transition"
                >
                  {/* Card Header / Thumbnail */}
                  <div className="flex justify-between items-center p-4 cursor-pointer" onClick={() => setExpandedCard(isExpanded ? null : i)}>
                    <div>
                      <p className="text-sm font-semibold text-blue-700">
                        {b.employeeId?.individualName || "Employee"} — {b.roleId?.roleName || "Role"}
                      </p>
                      <p className="text-xs text-gray-600">
                        Paid For: {b.month} {b.year} | Paid At: {b.paidMonth} {b.paidYear} {b.paidTime}
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        Net Salary: {formatRupees(b.calculatedBreakup?.netSalary || 0)}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* Dropdown */}
                      <div className="relative" ref={(el) => (dropdownRefs.current[i] = el)}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropdownOpen(isDropdownOpen ? null : i);
                          }}
                          className="px-2 py-1 text-gray-500 hover:text-gray-700"
                        >
                          ⋮
                        </button>

                        {isDropdownOpen && (
                          <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-md z-20">
                            {actions.map((a, idx) => (
                              <button
                                key={idx}
                                className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${a.color || "text-gray-700"}`}
                                onClick={() => a.action(b._id)}
                              >
                                {a.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-gray-500">{isExpanded ? "▲" : "▼"}</div>
                    </div>
                  </div>

                  {/* Expanded Full Details */}
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-200 text-xs text-gray-700 space-y-2 bg-gray-50">
                      <p><strong>Salary Type:</strong> {b.salaryRules?.salaryType ?? "N/A"}</p>
                      <p><strong>Base Salary:</strong> {formatRupees(b.salaryRules?.baseSalary)}</p>
                      <p><strong>Breakup Month:</strong> {b.month} {b.year}</p>
                      <p><strong>Paid At:</strong> {b.paidAt}</p>

                      {/* Allowances */}
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

                      {/* Deductions */}
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

                      {/* Terminal Benefits */}
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

                      {/* Calculated Breakdown */}
                      {b.calculatedBreakup && (
                        <>
                          <p className="font-medium mt-2">Calculated Breakup:</p>
                          <p>Total Allowances: {formatRupees(b.calculatedBreakup.totalAllowances)}</p>
                          <p>Total Deductions: {formatRupees(b.calculatedBreakup.totalDeductions)}</p>
                          <p>Net Salary: {formatRupees(b.calculatedBreakup.netSalary)}</p>

                          {b.calculatedBreakup.breakdown?.length > 0 && (
                            <table className="w-full mt-2 text-xs text-gray-700 border-collapse">
                              <thead>
                                <tr className="border-b bg-gray-100">
                                  <th className="px-2 py-1 text-left">Name</th>
                                  <th className="px-2 py-1">Category</th>
                                  <th className="px-2 py-1">Calculation</th>
                                  <th className="px-2 py-1">Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {b.calculatedBreakup.breakdown.map((bd, idx) => (
                                  <tr key={idx} className="border-b">
                                    <td className="px-2 py-1">{bd.name}</td>
                                    <td className="px-2 py-1">{bd.category}</td>
                                    <td className="px-2 py-1">{bd.calculation}</td>
                                    <td className="px-2 py-1">
                                      {formatRupees(bd.value)} {bd.excludeFromTotals ? "(Excluded)" : ""}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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

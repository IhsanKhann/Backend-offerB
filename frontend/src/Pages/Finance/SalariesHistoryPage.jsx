// SalaryHistoryPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar.jsx";
import api from "../../api/axios.js";

/**
 * SalaryHistoryPage
 * - Shows a list of salary breakup cards for an employee
 * - Collapsed thumbnail shows key info (month/year, paidAt, base, counts, net)
 * - Clicking a card expands full detailed breakdown (allowances/deductions/terminal + calculatedBreakup)
 * - Each card has a dropdown actions menu (scalable)
 */

const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

const formatRupees = (amt) => `PKR ${Number(amt || 0).toLocaleString()}`;

const safeDateStr = (d) => {
  if (!d) return "N/A";
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    return date.toLocaleString();
  } catch {
    return String(d);
  }
};

export default function SalaryHistoryPage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [breakups, setBreakups] = useState([]);
  const [expandedCard, setExpandedCard] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(null);

  // store refs for dropdown containers so we can detect outside clicks
  const dropdownRefs = useRef({});

  // fetch history
  useEffect(() => {
  let mounted = true;
    const fetchHistory = async () => {
      setLoading(true);
        try {
          const res = await api.get(`/summaries/salary/breakups/${employeeId}`);
          const items = res.data?.breakups ?? [];
          if (mounted) setBreakups(Array.isArray(items) ? items : []);

          console.log("Salaries history response: ", items);
        } catch (err) {
          console.error("Error loading salary history", err);
          if (mounted) setBreakups([]);
        } finally {
          if (mounted) setLoading(false);
        }
      };
      if (employeeId) fetchHistory();
      return () => { mounted = false; };
    }, [employeeId]);

  // close dropdown when clicking outside any dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      const openKey = dropdownOpen;
      if (openKey == null) return;
      const node = dropdownRefs.current[openKey];
      if (!node) {
        setDropdownOpen(null);
        return;
      }
      if (!node.contains(e.target)) setDropdownOpen(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  // Delete breakup controller connector
  const handleDeleteBreakup = async (breakupId) => {
    const ok = window.confirm("Are you sure you want to delete this breakup?");
    if (!ok) return;
    try {
      const res = await api.delete(`/summaries/breakup/${breakupId}`);
      if (res.data?.success) {
        setBreakups((prev) => prev.filter((b) => String(b._id) !== String(breakupId)));
        alert("Breakup deleted successfully.");
      } else {
        alert(res.data?.message || "Failed to delete breakup");
      }
    } catch (err) {
      console.error("Error deleting breakup:", err);
      alert("Error deleting breakup");
    }
  };

  // Scalable actions array: add more items (name, action, color)
  const actions = [
    { name: "Delete Breakup", action: handleDeleteBreakup, color: "text-red-600" },
    // Example: { name: "Download PDF", action: (id) => downloadPDF(id), color: "text-gray-700" }
  ];

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
          <div className="space-y-4">
            {breakups.map((b, i) => {
              // defensive property extraction (server might return compiled objects)
              const id = b._id || b.breakupId || b.breakup || `idx-${i}`;
              const emp = b.employeeId || {};
              const role = b.roleId || {};
              const salaryRules = b.salaryRules || {};
              const calc = b.calculatedBreakup || {};
              const breakdown = calc.breakdown || [];

              const paidMonth = b.paidMonth || (b.paidAt ? new Date(b.paidAt).toLocaleString("en-US", { month: "long" }) : null);
              const paidYear = b.paidYear || (b.paidAt ? new Date(b.paidAt).getFullYear() : null);
              const paidTime = b.paidTime || (b.paidAt ? new Date(b.paidAt).toLocaleTimeString() : null);

              const isExpanded = expandedCard === i;
              const isDropdownOpen = dropdownOpen === i;

              return (
                <div key={id} className="rounded-xl border border-gray-200 shadow-sm bg-white hover:shadow-md transition">
                  {/* Thumbnail / Collapsed Header */}
                  <div
                    className="flex justify-between items-center p-4 cursor-pointer"
                    onClick={() => setExpandedCard(isExpanded ? null : i)}
                    aria-hidden
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-700">
                        {emp.individualName || emp.name || "Employee"}{" "}
                        <span className="text-xs text-gray-500">— {role.roleName || role.name || "Role"}</span>
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                        <div>
                          <span className="font-medium text-gray-800">Breakup:</span>{" "}
                          {b.month} {b.year}
                        </div>

                        <div>
                          <span className="font-medium text-gray-800">Paid:</span>{" "}
                          {paidMonth && paidYear ? `${paidMonth} ${paidYear}` : safeDateStr(b.paidAt)}
                          {paidTime ? ` • ${paidTime}` : ""}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-4">
                        <div className="text-sm font-medium text-gray-900">
                          Net: {formatRupees(calc.netSalary ?? 0)}
                        </div>

                        <div className="text-xs text-gray-600">
                          Base: {formatRupees(salaryRules.baseSalary ?? 0)}
                        </div>

                        <div className="flex items-center space-x-2 text-[11px] text-gray-600">
                          <span className="px-2 py-0.5 bg-green-50 rounded-full">A: {salaryRules.allowances?.length ?? 0}</span>
                          <span className="px-2 py-0.5 bg-yellow-50 rounded-full">D: {salaryRules.deductions?.length ?? 0}</span>
                          <span className="px-2 py-0.5 bg-blue-50 rounded-full">T: {salaryRules.terminalBenefits?.length ?? 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions + caret */}
                    <div className="flex items-center gap-3 ml-4">
                      <div className="relative" ref={(el) => (dropdownRefs.current[i] = el)}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropdownOpen(isDropdownOpen ? null : i);
                          }}
                          aria-haspopup="true"
                          aria-expanded={isDropdownOpen}
                          className="p-2 rounded hover:bg-gray-100 text-gray-600"
                          title="Actions"
                        >
                          ⋮
                        </button>

                        {isDropdownOpen && (
                          <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-md z-20">
                            {actions.map((a, idx) => (
                              <button
                                key={idx}
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setDropdownOpen(null);
                                  a.action(id);
                                }}
                                className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${a.color || "text-gray-700"}`}
                              >
                                {a.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-gray-500 select-none">{isExpanded ? "▲" : "▼"}</div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-100 text-xs text-gray-700 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold mb-2">Salary Rules</p>
                          <p><strong>Salary Type:</strong> {salaryRules.salaryType || "N/A"}</p>
                          <p><strong>Base Salary:</strong> {formatRupees(salaryRules.baseSalary ?? 0)}</p>

                          {/* Allowances */}
                          <div className="mt-3">
                            <p className="font-medium">Allowances ({salaryRules.allowances?.length ?? 0})</p>
                            {salaryRules.allowances && salaryRules.allowances.length > 0 ? (
                              <ul className="mt-1 space-y-1">
                                {salaryRules.allowances.map((a, idx) => (
                                  <li key={idx} className="flex justify-between">
                                    <span>{a.name} <span className="text-xs text-gray-500">({a.type})</span></span>
                                    <span>{a.type === "percentage" ? `${a.value}%` : formatRupees(a.value)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-gray-500 mt-1">No allowances</p>
                            )}
                          </div>

                          {/* Terminal Benefits */}
                          <div className="mt-3">
                            <p className="font-medium">Terminal Benefits ({salaryRules.terminalBenefits?.length ?? 0})</p>
                            {salaryRules.terminalBenefits && salaryRules.terminalBenefits.length > 0 ? (
                              <ul className="mt-1 space-y-1">
                                {salaryRules.terminalBenefits.map((t, idx) => (
                                  <li key={idx} className="flex justify-between">
                                    <span>{t.name} <span className="text-xs text-gray-500">({t.type})</span></span>
                                    <span>{t.type === "percentage" ? `${t.value}%` : formatRupees(t.value)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-gray-500 mt-1">No terminal benefits</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-semibold mb-2">Deductions & Calculations</p>

                          {/* Deductions */}
                          <div>
                            <p className="font-medium">Deductions ({salaryRules.deductions?.length ?? 0})</p>
                            {salaryRules.deductions && salaryRules.deductions.length > 0 ? (
                              <ul className="mt-1 space-y-1">
                                {salaryRules.deductions.map((d, idx) => (
                                  <li key={idx} className="flex justify-between">
                                    <span>{d.name} <span className="text-xs text-gray-500">({d.type})</span></span>
                                    <span>{d.type === "percentage" ? `${d.value}%` : formatRupees(d.value)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-gray-500 mt-1">No deductions</p>
                            )}
                          </div>

                          {/* CalculatedBreakup summary */}
                          <div className="mt-3">
                            <p className="font-medium">Calculated Breakup</p>
                            <div className="mt-1 space-y-1">
                              <div className="flex justify-between">
                                <span>Total Allowances</span>
                                <span>{formatRupees(calc.totalAllowances ?? 0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total Deductions</span>
                                <span>{formatRupees(calc.totalDeductions ?? 0)}</span>
                              </div>
                              <div className="flex justify-between font-semibold">
                                <span>Net Salary</span>
                                <span>{formatRupees(calc.netSalary ?? 0)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Full breakdown table */}
                      {breakdown && breakdown.length > 0 && (
                        <div className="mt-4">
                          <p className="font-medium mb-2">Breakdown</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-gray-700 border-collapse">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="p-2 text-left">Name</th>
                                  <th className="p-2 text-left">Category</th>
                                  <th className="p-2 text-left">Calculation</th>
                                  <th className="p-2 text-right">Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {breakdown.map((bd, idx) => (
                                  <tr key={idx} className="border-b even:bg-white odd:bg-gray-50">
                                    <td className="p-2">{bd.name}</td>
                                    <td className="p-2">{bd.category}</td>
                                    <td className="p-2">{bd.calculation}</td>
                                    <td className="p-2 text-right">
                                      {formatRupees(bd.value)} {bd.excludeFromTotals ? <span className="text-xs text-gray-500"> (Excluded)</span> : null}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* meta */}
                      <div className="mt-4 text-[12px] text-gray-500">
                        <div>Paid At (raw): {safeDateStr(b.paidAt)}</div>
                        <div>Record created: {safeDateStr(b.createdAt)}</div>
                        <div>Record updated: {safeDateStr(b.updatedAt)}</div>
                      </div>
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
}

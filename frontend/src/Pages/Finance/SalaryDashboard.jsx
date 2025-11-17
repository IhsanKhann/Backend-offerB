// SalaryDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios.js";
import SalaryModal from "../../components/SalaryModal.jsx";
import Sidebar from "../../components/Sidebar.jsx";

const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

// SalaryHistoryModal.jsx (inline inside SalaryDashboard.jsx for now)
const SalaryHistoryModal = ({ isOpen, onClose, employeeId }) => {
  const [loading, setLoading] = useState(false);
  const [breakups, setBreakups] = useState([]);
  const [expandedCard, setExpandedCard] = useState(null); // track expanded card

  useEffect(() => {
    if (!isOpen) return;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/summaries/salary/breakups/${employeeId}`);
        setBreakups(res.data.data || []);
      } catch (err) {
        console.error("Error loading salary history", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, employeeId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        className="bg-white w-[90%] max-w-5xl max-h-[90vh] rounded-xl shadow-lg p-6 overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Salary History</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500">✖</button>
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}

        {!loading && breakups.length === 0 && (
          <p className="text-gray-500 text-center py-6">No salary breakups found.</p>
        )}

        <div className="space-y-3 mt-4">
          {breakups.map((b, i) => {
            const isExpanded = expandedCard === i;
            return (
              <div
                key={i}
                className="rounded-xl border border-gray-200 shadow-sm hover:shadow-md bg-gray-50 cursor-pointer"
              >
                {/* Card Thumbnail */}
                <div
                  className="flex justify-between items-center p-4"
                  onClick={() => setExpandedCard(isExpanded ? null : i)}
                >
                  <div>
                    <p className="text-sm font-medium text-blue-700">{b.month} {b.year}</p>
                    <p className="text-xs text-gray-600">Base: {b.salaryRules?.baseSalary ?? 0}</p>
                  </div>
                  <div className="text-gray-500">{isExpanded ? "▲" : "▼"}</div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-gray-200 text-xs text-gray-700 space-y-2">
                    <p>Employee: {b.employeeId?.individualName || "N/A"} ({b.employeeId?.UserId || "N/A"})</p>
                    <p>Role: {b.roleId?.roleName || "N/A"}</p>
                    <p>Salary Type: {b.salaryRules?.salaryType ?? "N/A"}</p>

                    {b.salaryRules?.terminalBenefits?.length > 0 && (
                      <>
                        <p className="font-medium mt-2">Terminal Benefits:</p>
                        {b.salaryRules.terminalBenefits.map((t, idx) => (
                          <p key={idx}>{t.name} ({t.type}): {t.value}</p>
                        ))}
                      </>
                    )}

                    {b.salaryRules?.allowances?.length > 0 && (
                      <>
                        <p className="font-medium mt-2">Allowances:</p>
                        {b.salaryRules.allowances.map((a, idx) => (
                          <p key={idx}>{a.name} ({a.type}): {a.value}</p>
                        ))}
                      </>
                    )}

                    {b.salaryRules?.deductions?.length > 0 && (
                      <>
                        <p className="font-medium mt-2">Deductions:</p>
                        {b.salaryRules.deductions.map((d, idx) => (
                          <p key={idx}>{d.name} ({d.type}): {d.value}</p>
                        ))}
                      </>
                    )}

                    {b.calculatedBreakup && (
                      <>
                        <p className="font-medium mt-2">Calculated Breakup:</p>
                        <p>Total Allowances: {b.calculatedBreakup.totalAllowances}</p>
                        <p>Total Deductions: {b.calculatedBreakup.totalDeductions}</p>
                        <p>Net Salary: {b.calculatedBreakup.netSalary}</p>

                        {b.calculatedBreakup.breakdown?.length > 0 && (
                          <>
                            <p className="font-medium mt-1">Breakdown:</p>
                            {b.calculatedBreakup.breakdown.map((bd, idx) => (
                              <p key={idx}>
                                {bd.name} ({bd.category}): {bd.value} {bd.excludeFromTotals ? "(Excluded)" : ""}
                                {bd.calculation ? ` [${bd.calculation}]` : ""}
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
      </motion.div>
    </div>
  );
};

const SalaryDashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [historyEmployeeId, setHistoryEmployeeId] = useState(null);

  const navigate = useNavigate();

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get("/finalizedEmployees/allWithRoles");
      const employeesData = res.data.data || [];

      const mappedEmployees = employeesData.map((emp) => ({
        ...emp,
        roleName: emp.role?.roleName || emp.role?.name || "N/A",
      }));

      setEmployees(mappedEmployees);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  if (loading) return <Loader />;

  const navItems = [
    { name: "Salary Dashboard", path: "/salary-dashboard" },
    { name: "All Summaries", path: "/summary-table" },
    { name: "All Tables", path: "/tables" },
    { name: "Testing", path: "/paymentDashboard"},
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="sticky top-0 h-screen">
        <Sidebar navItems={navItems} title="SalaryDashboard" />
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold mb-4">Employee Salaries</h1>

        {employees.length === 0 ? (
          <p className="text-gray-500 text-sm md:text-base">No employees found.</p>
        ) : (
          <div className="space-y-3">
            {employees.map((emp) => (
              <div
                key={emp._id}
                className="bg-white rounded-xl shadow-md p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:shadow-lg transition-all border border-gray-200"
              >
                {/* Employee Info */}
                <div className="flex items-center space-x-3 md:w-1/3">
                  {emp.avatar?.url ? (
                    <img
                      src={emp.avatar.url}
                      alt="Avatar"
                      className="w-16 h-16 rounded-full object-cover border border-blue-300"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-sm font-semibold">
                      N/A
                    </div>
                  )}
                  <div className="flex flex-col">
                    <p className="text-base font-semibold text-gray-800">{emp.individualName}</p>
                    <p className="text-xs text-gray-500">{emp.personalEmail}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <span className="text-xs text-gray-400">ID: {emp.UserId}</span>
                      <span className="text-xs text-gray-400">Org: {emp.organizationUnit || "N/A"}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{emp.roleName}</span>
                    </div>
                  </div>
                </div>

               {/* Salary Info */}
              <div className="mt-3 md:mt-0 md:w-2/3 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-700">

                <p><span className="font-medium">Base Salary:</span> {emp.salary?.amount || "N/A"}</p>
                <p><span className="font-medium">Salary Type:</span> {emp.salary?.type || "N/A"}</p>
                <p><span className="font-medium">Start Date:</span> {emp.salary?.startDate ? new Date(emp.salary.startDate).toLocaleDateString() : "N/A"}</p>

             {/* Terminal Benefit Fields */}
              <p>
                <span className="font-medium">Gratuity:</span> {emp.salary?.terminalBenefits?.gratuity ?? 0}
              </p>
              <p>
                <span className="font-medium">Provident Fund:</span> {emp.salary?.terminalBenefits?.providentFund ?? 0}
              </p>
              <p>
                <span className="font-medium">EOBI:</span> {emp.salary?.terminalBenefits?.eobi ?? 0}
              </p>
              <p>
                <span className="font-medium">Cost of Funds:</span> {emp.salary?.terminalBenefits?.costOfFunds ?? 0}
              </p>
              <p>
                <span className="font-medium">Insurance:</span> {emp.salary?.terminalBenefits?.groupTermInsurance ?? 0}
              </p>
              <p>
                <span className="font-medium">Other Benefits:</span> {emp.salary?.terminalBenefits?.otherBenefits ?? 0}
              </p>


                {/* Salary Details (Allowances and Deductions) */}
                {emp.salary?.salaryDetails?.length > 0 && (
                  <div className="col-span-full mt-2 border-t pt-2 text-xs text-gray-500">
                    {emp.salary.salaryDetails.map((detail, idx) => (
                      <p key={idx} className="flex justify-between">
                        <span>{detail.name} ({detail.type})</span>
                        <span>
                          {detail.value} {detail.calculation ? `(${detail.calculation})` : ""}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
              </div>


                {/* Action Menu */}
                <div className="mt-3 md:mt-0 relative">
                  <button
                    onClick={() =>
                      setOpenActionMenu(openActionMenu === emp._id ? null : emp._id)
                    }
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full shadow text-xs flex items-center justify-between w-28"
                  >
                    Actions
                    <span className={`ml-1 transition-transform duration-300 ${openActionMenu === emp._id ? "rotate-180" : ""}`}>
                      ▼
                    </span>
                  </button>

                  <AnimatePresence>
                    {openActionMenu === emp._id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col overflow-hidden z-50"
                      >
                        <button
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setOpenActionMenu(null);
                          }}
                          className="px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        >
                          Pay Salary
                        </button>
                        <button
                          onClick={() => {
                            navigate(`/salary/breakup/${emp._id}`);
                            setOpenActionMenu(null);
                          }}
                          className="px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        >
                          View Breakup
                        </button>
                        <button
                          onClick={() => {
                            setHistoryEmployeeId(emp._id);
                            setOpenActionMenu(null);
                          }}
                          className="px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        >
                          Salaries History
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Salary Modal */}
        {selectedEmployee && (
          <SalaryModal
            employee={selectedEmployee}
            isOpen={!!selectedEmployee}
            onClose={() => setSelectedEmployee(null)}
            redirectToBreakup={(empId) => navigate(`/salary/breakup/${empId}`)}
          />
        )}

        {historyEmployeeId && (
        <SalaryHistoryModal
          isOpen={!!historyEmployeeId}
          employeeId={historyEmployeeId}
          onClose={() => setHistoryEmployeeId(null)}
        />
      )}

      </div>
    </div>
  );
};

export default SalaryDashboard;

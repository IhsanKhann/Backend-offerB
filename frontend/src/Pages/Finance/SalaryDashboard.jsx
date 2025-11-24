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

const SalaryDashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [openActionMenu, setOpenActionMenu] = useState(null);

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
                  <p><span className="font-medium">Gratuity:</span> {emp.salary?.terminalBenefits?.gratuity ?? 0}</p>
                  <p><span className="font-medium">Provident Fund:</span> {emp.salary?.terminalBenefits?.providentFund ?? 0}</p>
                  <p><span className="font-medium">EOBI:</span> {emp.salary?.terminalBenefits?.eobi ?? 0}</p>
                  <p><span className="font-medium">Cost of Funds:</span> {emp.salary?.terminalBenefits?.costOfFunds ?? 0}</p>
                  <p><span className="font-medium">Insurance:</span> {emp.salary?.terminalBenefits?.groupTermInsurance ?? 0}</p>
                  <p><span className="font-medium">Other Benefits:</span> {emp.salary?.terminalBenefits?.otherBenefits ?? 0}</p>

                  {/* Salary Details (Allowances/Deductions) */}
                  {emp.salary?.salaryDetails?.length > 0 && (
                    <div className="col-span-full mt-2 border-t pt-2 text-xs text-gray-500">
                      {emp.salary.salaryDetails.map((detail, idx) => (
                        <p key={idx} className="flex justify-between">
                          <span>{detail.name} ({detail.type})</span>
                          <span>{detail.value} {detail.calculation ? `(${detail.calculation})` : ""}</span>
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
                    <span
                      className={`ml-1 transition-transform duration-300 ${
                        openActionMenu === emp._id ? "rotate-180" : ""
                      }`}
                    >
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
                            navigate(`/salary/history/${emp._id}`);
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
      </div>
    </div>
  );
};

export default SalaryDashboard;

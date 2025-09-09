import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios.js";
import SalaryModal from "../../components/SalaryModal.jsx";
import Sidebar from "../../components/Sidebar.jsx";

const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

const SalaryDashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const navigate = useNavigate();

  // Fetch all employees
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

  // Sidebar nav items
  const navItems = [
    { name: "Salary Dashboard", path: "/salary-dashboard" },
    { name: "Salary and Roles Table", path: "/salary/rulesTable" },
    { name: "Rules Table", path: "/tables" },
    { name: "Breakup Summary", path: "/salary/breakup" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar navItems={navItems} fetchEmployeesByNode={() => {}} />

      {/* Main content */}
      <div className="flex-1 p-6 space-y-4">
        <h1 className="text-3xl font-bold mb-6">Employee Salaries</h1>

        {employees.length === 0 ? (
          <p className="text-gray-500 text-lg">No employees found.</p>
        ) : (
          <div className="space-y-4">
            {employees.map((emp) => (
              <div
                key={emp._id}
                className="bg-white shadow rounded-xl p-4 flex justify-between items-start space-x-4 hover:shadow-xl transition-all"
              >
                {/* Employee Info */}
                <div className="flex items-center space-x-4">
                  {emp.avatar?.url ? (
                    <img
                      src={emp.avatar.url}
                      alt="Avatar"
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
                      N/A
                    </div>
                  )}
                  <div className="flex flex-col">
                    <p className="text-lg font-semibold">{emp.individualName}</p>
                    <p className="text-sm text-gray-500">{emp.officialEmail || emp.personalEmail}</p>
                    <p className="text-xs text-gray-400">ID: {emp.UserId}</p>
                    <p className="text-xs text-gray-400">Org Unit: {emp.organizationUnit || "N/A"}</p>
                    <p className="text-xs text-gray-400">Role: {emp.roleName}</p>
                  </div>
                </div>

                {/* Salary Info */}
                <div className="flex flex-col space-y-1 text-right">
                  <p className="text-sm">
                    <span className="font-medium">Base Salary:</span>{" "}
                    {emp.salary?.amount || "N/A"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Salary Type:</span>{" "}
                    {emp.salary?.type || "N/A"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Terminal Benefits:</span>{" "}
                    {emp.salary?.terminalBenefits?.length || 0}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">EOBI:</span>{" "}
                    {emp.salary?.EOBI || "N/A"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Gratuity Fund:</span>{" "}
                    {emp.salary?.employeeGratuityFund || "N/A"}
                  </p>
                </div>

                {/* Action */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setSelectedEmployee(emp)}
                    className="px-4 py-2 bg-green-500 text-white rounded-md shadow hover:bg-green-600"
                  >
                    Pay Salary
                  </button>
                  <button
                    onClick={() => navigate(`/salary/breakup/${emp._id}`)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md shadow hover:bg-blue-600"
                  >
                    View Breakup
                  </button>
                  <button
                    onClick={() => navigate(`/salarytable/${emp.role?._id}`)}
                    className="px-4 py-2 bg-purple-500 text-white rounded-md shadow hover:bg-purple-600"
                  >
                    Role Salary Table
                  </button>
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

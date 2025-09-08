import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios.js";
import SalaryModal from "../../components/SalaryModal.jsx";

// Loader component
const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

const SalaryDashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const navigate = useNavigate();

  // Fetch all finalized employees with roles
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get("/finalizedEmployees/allWithRoles");
      const employeesData = res.data.data || [];

      const mappedEmployees = employeesData.map(emp => {
        const roleName = emp.role?.name || "N/A";
        const permissions = emp.role?.permissions?.map(p => p.name) || [];
        return { ...emp, roleName, permissions };
      });

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

  // Open modal for selected employee
  const handlePaySalary = (emp) => {
    setSelectedEmployee(emp);
  };

  // Render each employee card
  const renderEmployeeCard = (emp) => (
    <div
      key={emp._id}
      className="bg-white shadow rounded-xl p-4 flex justify-between items-start space-x-4 hover:shadow-xl transition-all"
    >
      {/* Employee Info */}
      <div className="flex items-center space-x-4">
        {emp.avatar ? (
          <img
            src={emp.avatar.url || "https://via.placeholder.com/150"}
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
          <p className="text-xs text-gray-400">Role: {emp.role?.name || "N/A"}</p>
        </div>
      </div>

      {/* Salary Info */}
      <div className="flex flex-col space-y-1 text-right">
        <p className="text-sm">
          <span className="font-medium">Salary Type:</span> {emp.salary?.type || "N/A"}
        </p>
        <p className="text-sm">
          <span className="font-medium">Amount:</span> ${emp.salary?.amount || 0}
        </p>
        <p className="text-sm">
          <span className="font-medium">Start Date:</span>{" "}
          {emp.salary?.startDate ? new Date(emp.salary.startDate).toLocaleDateString() : "N/A"}
        </p>
        <p className="text-sm">
          <span className="font-medium">Terminal Benefits:</span>{" "}
          {emp.salary?.terminalBenefits?.join(", ") || "N/A"}
        </p>
      </div>

      {/* Actions Dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpenDropdown(openDropdown === emp._id ? null : emp._id)}
          className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Actions &#9660;
        </button>

        {openDropdown === emp._id && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <button
              onClick={() => handlePaySalary(emp)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-100"
            >
              Pay Salary
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) return <Loader />;

  return (
    <div className="p-6 bg-gray-100 min-h-screen space-y-4">
      <h1 className="text-3xl font-bold mb-6">Employee Salaries</h1>

      {employees.length === 0 ? (
        <p className="text-gray-500 text-lg">No employees found.</p>
      ) : (
        <div className="space-y-4">{employees.map(renderEmployeeCard)}</div>
      )}

      {/* Salary Modal */}
      {selectedEmployee && (
        <SalaryModal
          employee={selectedEmployee}
          isOpen={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          redirectToBreakup={(empId) => navigate(`/summaries/salary/breakup/${empId}`)}
        />
      )}
    </div>
  );
};

export default SalaryDashboard;

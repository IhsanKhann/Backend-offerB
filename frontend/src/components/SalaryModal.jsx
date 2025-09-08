import React, { useEffect, useState } from "react";
import api from "../api/axios.js";

const SalaryModal = ({ employee, isOpen, onClose, redirectToBreakup }) => {
  const [salaryRules, setSalaryRules] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch salary rules when modal opens
  useEffect(() => {
    if (!employee?.role?.roleName || !isOpen) return;

    const fetchRules = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/summaries/salary/rules-by-role/${employee.role.roleName}`);
        if (!res.data?.data) throw new Error("No salary rules found");
        setSalaryRules(res.data.data);
      } catch (err) {
        console.error(err);
        alert("Failed to fetch salary rules");
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, [employee, isOpen]);

  // Handle changes to salary rules
  const handleChange = (path, value) => {
    setSalaryRules(prev => {
      const updated = { ...prev };
      const keys = path.split(".");
      let temp = updated;
      for (let i = 0; i < keys.length - 1; i++) temp = temp[keys[i]];
      temp[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  // Create breakup file
  const handleCreateBreakup = async () => {
    try {
      await api.post(`/summaries/salary/breakup/${employee._id}`, {
        salaryRules,
        roleId: employee.role._id
      });
      alert("Breakup file created!");
      onClose();
      redirectToBreakup(employee._id);
    } catch (err) {
      console.error(err);
      alert("Failed to create breakup file");
    }
  };

  if (!isOpen) return null;
  if (loading || !salaryRules) 
    return (
      <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50">
        <p className="text-white">Loading...</p>
      </div>
    );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl max-w-xl w-full space-y-4 overflow-y-auto max-h-[80vh]">
        <h2 className="text-xl font-bold mb-4">Edit Salary Rules</h2>

        <div className="space-y-3">
          <div>
            <label className="block font-medium">Base Salary:</label>
            <input
              type="number"
              value={salaryRules.baseSalary || 0}
              onChange={(e) => handleChange("baseSalary", Number(e.target.value))}
              className="border p-2 w-full rounded"
            />
          </div>

          <div>
            <label className="block font-medium">Salary Type:</label>
            <select
              value={salaryRules.salaryType || "monthly"}
              onChange={(e) => handleChange("salaryType", e.target.value)}
              className="border p-2 w-full rounded"
            >
              <option value="monthly">Monthly</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>

          {["allowances", "deductions", "terminalBenefits"].map(field => (
            <div key={field}>
              <h3 className="font-semibold capitalize">{field}</h3>
              {(salaryRules[field] || []).map((item, idx) => (
                <div key={idx} className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleChange(`${field}.${idx}.name`, e.target.value)}
                    placeholder="Name"
                    className="border p-1 rounded flex-1"
                  />
                  <select
                    value={item.type}
                    onChange={(e) => handleChange(`${field}.${idx}.type`, e.target.value)}
                    className="border p-1 rounded w-24"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">Percentage</option>
                  </select>
                  <input
                    type="number"
                    value={item.value}
                    onChange={(e) => handleChange(`${field}.${idx}.value`, Number(e.target.value))}
                    placeholder="Value"
                    className="border p-1 rounded w-20"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
          <button onClick={handleCreateBreakup} className="px-4 py-2 bg-blue-500 text-white rounded">
            Create Breakup
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalaryModal;

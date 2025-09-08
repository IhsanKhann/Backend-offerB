import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";

const BreakupSummary = ({ employeeId }) => {
  const [breakup, setBreakup] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBreakup = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/salary/breakup/${employeeId}`);
        setBreakup(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBreakup();
  }, [employeeId]);

  const handleSalaryTransaction = async () => {
    try {
      const res = await api.post(`/salary/transaction/${employeeId}`);
      alert(res.data.message);
    } catch (err) {
      console.error(err);
      alert("Failed to initiate salary transaction");
    }
  };

  if (loading || !breakup) return <div>Loading...</div>;

  return (
    <div className="p-6 bg-gray-100 min-h-screen space-y-4">
      <h1 className="text-3xl font-bold mb-6">Breakup Summary</h1>

      <div className="bg-white p-4 rounded shadow space-y-2">
        <p><strong>Base Salary:</strong> ${breakup.salaryRules.baseSalary}</p>
        <p><strong>Total Allowances:</strong> ${breakup.calculatedBreakup.totalAllowances}</p>
        <p><strong>Total Deductions:</strong> ${breakup.calculatedBreakup.totalDeductions}</p>
        <p><strong>Net Salary:</strong> ${breakup.calculatedBreakup.netSalary}</p>

        <h3 className="font-semibold mt-2">Breakdown:</h3>
        <ul className="list-disc pl-5">
          {breakup.calculatedBreakup.breakdown.map((b, idx) => (
            <li key={idx}>{b.name} ({b.type}): ${b.value}</li>
          ))}
        </ul>
      </div>

      <button
        onClick={handleSalaryTransaction}
        className="mt-4 px-4 py-2 bg-green-500 text-white rounded"
      >
        Initiate Salary Transaction
      </button>
    </div>
  );
};

export default BreakupSummary;

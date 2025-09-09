import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios.js";

const BreakupSummary = () => {
  const { employeeId } = useParams(); // Get employeeId from URL
  const [breakup, setBreakup] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employeeId) return;

    const fetchBreakup = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/summaries/salary/breakup/${employeeId}`);
        setBreakup(res.data.data);
      } catch (err) {
        console.error(err);
        alert("Failed to fetch breakup file");
      } finally {
        setLoading(false);
      }
    };

    fetchBreakup();
  }, [employeeId]);

  const handleSalaryTransaction = async () => {
    try {
      const res = await api.post(`/salary/transaction/${employeeId}`);
      alert(res.data.message || "Salary transaction completed");
    } catch (err) {
      console.error(err);
      alert("Failed to initiate salary transaction");
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!breakup) return <div className="p-6">No breakup file found for this employee.</div>;

  const { salaryRules, calculatedBreakup } = breakup;

  // Helper to format numbers in PKR
  const formatRupees = (amount) => `PKR ${Number(amount).toLocaleString()}`;

  return (
    <div className="p-6 bg-gray-100 min-h-screen space-y-4">
      <h1 className="text-3xl font-bold mb-6">Breakup Summary</h1>

      <div className="bg-white p-4 rounded shadow space-y-2">
        <p><strong>Base Salary:</strong> {formatRupees(salaryRules.baseSalary)}</p>
        <p><strong>Total Allowances:</strong> {formatRupees(calculatedBreakup.totalAllowances)}</p>
        <p><strong>Total Deductions:</strong> {formatRupees(calculatedBreakup.totalDeductions)}</p>
        <p><strong>Net Salary:</strong> {formatRupees(calculatedBreakup.netSalary)}</p>

        <h3 className="font-semibold mt-2">Breakdown:</h3>
        <ul className="list-disc pl-5">
          {calculatedBreakup.breakdown.map((b, idx) => (
            <li key={idx}>
              {b.name} ({b.type}): {formatRupees(b.value)}
            </li>
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

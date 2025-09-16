import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios.js";

const BreakupSummary = () => {
  const { employeeId } = useParams();
  const [breakup, setBreakup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!employeeId) return;

    const fetchBreakup = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/summaries/salary/breakup/${employeeId}`);
        setBreakup(res.data.data);
      } catch (err) {
        console.error("Error fetching breakup:", err);
        alert("Failed to fetch breakup file");
      } finally {
        setLoading(false);
      }
    };

    fetchBreakup();
  }, [employeeId]);

  const handleSalaryTransaction = async () => {
    if (!window.confirm("Are you sure you want to process this salary transaction?")) return;

    if (!breakup?.calculatedBreakup?.breakdown?.length) {
      alert("No breakup data available to process salary.");
      return;
    }

    setProcessing(true);

    try {
      const payload = {
        salary: {
          splits: breakup.calculatedBreakup.breakdown.map((item) => ({
            name: item.name,
            value: item.value,
            type: item.category === "deduction" ? "credit" : "debit",
            summaryId: item.summaryId || null,
            instanceId: item.instanceId || null,
            definitionId: item.definitionId || null,
          })),
        },
        transactionDate: new Date(),
        description: `Salary for ${employeeId}`,
      };

      console.log("Payload being sent to API:", payload);

      const res = await api.post(`/transactions/salary/${employeeId}`, payload);

      console.log("Response from API:", res.data);
      alert(res.data?.message || "Salary transaction completed");

      setBreakup(null);
    } catch (err) {
      console.error("Error processing salary:", err);
      alert("Failed to initiate salary transaction");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!breakup) return <div className="p-6">No breakup file found for this employee.</div>;

  const { salaryRules, calculatedBreakup } = breakup;
  const formatRupees = (amt) => `PKR ${Number(amt || 0).toLocaleString()}`;

  const allowances = calculatedBreakup.breakdown.filter((b) => b.category === "allowance");
  const deductions = calculatedBreakup.breakdown.filter((b) => b.category === "deduction");

  return (
    <div className="p-6 bg-gray-100 min-h-screen flex justify-center">
      <div className="bg-white shadow-lg rounded-lg w-full max-w-xl p-6 space-y-6">
        <h1 className="text-3xl font-bold text-center mb-4">Salary Slip</h1>
        <p className="text-center text-gray-600">This is how your salary has been split</p>

        {/* Base Salary */}
        <div className="border-t border-b py-4">
          <h2 className="text-lg font-semibold mb-2">Base Salary</h2>
          <div className="flex justify-between">
            <span>Base Salary:</span>
            <span>{formatRupees(salaryRules.baseSalary)}</span>
          </div>
        </div>

        {/* Allowances */}
        <div className="border-b py-4">
          <h2 className="text-lg font-semibold mb-2">Allowances</h2>
          {allowances.length ? (
            allowances.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{item.name}</span>
                <span>{formatRupees(item.value)}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No allowances</p>
          )}
          <div className="flex justify-between mt-2 font-semibold">
            <span>Total Allowances:</span>
            <span>{formatRupees(calculatedBreakup.totalAllowances)}</span>
          </div>
        </div>

        {/* Deductions */}
        <div className="border-b py-4">
          <h2 className="text-lg font-semibold mb-2">Deductions</h2>
          {deductions.length ? (
            deductions.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{item.name}</span>
                <span>-{formatRupees(item.value)}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No deductions</p>
          )}
          <div className="flex justify-between mt-2 font-semibold">
            <span>Total Deductions:</span>
            <span>{formatRupees(calculatedBreakup.totalDeductions)}</span>
          </div>
        </div>

        {/* Net Salary (Final Salary) */}
        <div className="py-4 flex justify-between items-center font-bold text-xl">
          <span>Net Salary (Final):</span>
          <span>{formatRupees(calculatedBreakup.netSalary)}</span>
        </div>

        {/* Process Salary Button */}
        <button
          onClick={handleSalaryTransaction}
          disabled={processing}
          className={`w-full py-3 rounded text-white font-semibold ${
            processing ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {processing ? "Processing..." : "Initiate Salary Transaction"}
        </button>
      </div>
    </div>
  );
};

export default BreakupSummary;

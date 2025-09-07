import React, { useEffect, useState, useCallback } from "react";
import api from "../../api/axios.js";

export default function ExpenseManager() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expense, setExpense] = useState({ amount: 0, description: "", name: "" });
  const [capital, setCapital] = useState(0);
  const [cash, setCash] = useState(0);

  // Load summaries with field lines
  const loadSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/summaries/summary-field-lines");
      setSummaries(res.data);
    } catch (err) {
      console.error("Error loading summaries:", err);
      setError("Failed to load summaries. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  const handleExpenseChange = (e) => {
    setExpense({ ...expense, [e.target.name]: e.target.value });
  };

  const postExpense = async () => {
    if (!expense.amount || !expense.name) {
      alert("Please enter amount and name");
      return;
    }
    
    try {
      await api.post("/transactions/expense", {
        amount: Number(expense.amount),
        description: expense.description,
        name: expense.name,
      });
      setExpense({ amount: 0, description: "", name: "" });
      await loadSummaries();
      alert("Expense posted successfully!");
    } catch (err) {
      console.error("Error posting expense:", err);
      alert(err.response?.data?.error || "Error posting expense");
    }
  };

  const resetSummaries = async () => {
    if (!window.confirm("Are you sure you want to reset all balances to zero?")) return;
    try {
      await api.post("/summaries/reset-summaries");
      await loadSummaries();
      alert("All balances have been reset to zero.");
    } catch (err) {
      console.error("Error resetting summaries:", err);
      alert("Error resetting summaries");
    }
  };

  const initCapitalCash = async () => {
    if (!capital || !cash) {
      alert("Please enter both capital and cash amounts");
      return;
    }
    try {
      await api.post("/summaries/init-capital-cash", { 
        capitalAmount: Number(capital), 
        cashAmount: Number(cash) 
      });
      await loadSummaries();
      alert("Capital and Cash initialized successfully!");
    } catch (err) {
      console.error("Error initializing capital/cash:", err);
      alert("Error initializing capital and cash");
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amount);
  };

  // Format with + / -
  const formatSignedCurrency = (amount) => {
    if (!amount) amount = 0;
    const sign = amount >= 0 ? "+" : "-";
    return `${sign}${formatCurrency(Math.abs(amount))}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Loading summaries...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Expense Manager</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Admin Controls */}
      <div className="border rounded p-4 bg-gray-50 space-y-3">
        <h2 className="font-semibold text-lg">Admin Controls</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={resetSummaries}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Reset All Balances
          </button>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Capital:</label>
            <input
              type="number"
              placeholder="Capital"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="border p-2 rounded w-32"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Cash:</label>
            <input
              type="number"
              placeholder="Cash"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              className="border p-2 rounded w-32"
            />
          </div>
          <button
            onClick={initCapitalCash}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            Initialize Capital & Cash
          </button>
        </div>
      </div>

      {/* Post Expense */}
      <div className="border rounded p-4 bg-gray-50 space-y-3">
        <h2 className="font-semibold text-lg">Post Expense</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="number"
            name="amount"
            value={expense.amount}
            onChange={handleExpenseChange}
            placeholder="Amount"
            className="border p-2 rounded"
            step="0.01"
            min="0"
          />
          <input
            type="text"
            name="name"
            value={expense.name}
            onChange={handleExpenseChange}
            placeholder="Expense Name"
            className="border p-2 rounded"
          />
          <input
            type="text"
            name="description"
            value={expense.description}
            onChange={handleExpenseChange}
            placeholder="Description"
            className="border p-2 rounded"
          />
          <button
            onClick={postExpense}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Post Expense
          </button>
        </div>
      </div>

      {/* Summaries Display */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-lg">Account Summaries</h2>
          <button
            onClick={loadSummaries}
            className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 transition-colors"
          >
            Refresh
          </button>
        </div>
        
        {summaries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No summaries found. Please initialize the system first.
          </div>
        ) : (
          summaries.map((summary) => (
            <div key={summary._id} className="border rounded p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-lg">{summary.name}</h3>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    Start: {formatSignedCurrency(summary.startingBalance || 0)}
                  </div>
                  <div className="text-lg font-bold">
                    End: {formatSignedCurrency(summary.endingBalance || 0)}
                  </div>
                </div>
              </div>
              
              {summary.fieldLines && summary.fieldLines.length > 0 && (
                <div className="border-t pt-3">
                  <h4 className="font-medium mb-2">Field Lines:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {summary.fieldLines.map((fieldLine) => (
                      <div key={fieldLine._id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm">{fieldLine.name}:</span>
                        <span className="font-medium">{formatSignedCurrency(fieldLine.balance || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

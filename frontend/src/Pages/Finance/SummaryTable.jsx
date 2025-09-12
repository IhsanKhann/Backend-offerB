import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar.jsx";
import api from "../../api/axios.js";
import { FaDollarSign, FaMoneyBillWave, FaFileInvoiceDollar, FaTachometerAlt } from "react-icons/fa";

const Loader = () => (
  <div className="flex justify-center items-center min-h-[40vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

export default function SummaryManager() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");

  // Controls state
  const [cash, setCash] = useState("");
  const [capital, setCapital] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseName, setExpenseName] = useState("");

  // Fetch summaries
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/summaries/with-fieldlines");
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];

      const normalized = data.map((s) => ({
        ...s,
        fieldLines: (s.fieldLines || []).map((fl) => ({
          ...fl,
          fieldLineNumericId: Number(fl.fieldLineNumericId || fl.accountNumber || fl.fieldLineId),
        })),
      }));
      setSummaries(normalized);
    } catch (err) {
      console.error("Failed to fetch summaries", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Format helpers
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR" }).format(amount || 0);

  const getLineDebitCredit = (summaryNumericId, fieldLine) => {
    const val = Number(fieldLine.balance || 0);
    return val >= 0
      ? { debit: val, credit: 0, sign: "+" }
      : { debit: 0, credit: Math.abs(val), sign: "-" };
  };

  const renderAmountCell = (amount, isDebit) => {
    if (!amount || amount === 0) return <span className="text-sm text-gray-400">—</span>;
    return <span className={`font-medium ${isDebit ? "text-green-700" : "text-red-700"}`}>{formatCurrency(amount)}</span>;
  };

  // Finance Controls
  const FinanceControls = () => {
    const handleReset = async () => {
      try {
        const res = await api.post("/summaries/reset");
        setMessage(res.data.message || "All summaries reset ✅");
        fetchAll();
      } catch (err) {
        setMessage("Error resetting: " + (err.response?.data?.error || err.message));
      }
    };

    const handleTransaction = async (type) => {
      try {
        let payload = {};
        let endpoint = "";
        switch (type) {
          case "initBalances":
            payload = { cash: Number(cash), capital: Number(capital) };
            endpoint = "/transactions/transfer-retained-to-capital"; // example route
            break;
          case "expense":
            payload = { amount: Number(expenseAmount), name: expenseName };
            endpoint = "/transactions/expense";
            break;
          case "commissionTest":
            endpoint = "/transactions/commission/test";
            break;
          case "commissionClose":
            endpoint = "/transactions/commission/close-to-retained";
            break;
          default:
            break;
        }
        if (!endpoint) return;
        await api.post(endpoint, payload);
        setMessage("Transaction completed ✅");
        fetchAll();
      } catch (err) {
        setMessage("Error: " + (err.response?.data?.error || err.message));
      }
    };

    return (
      <div className="p-6 mb-6 bg-gray-50 rounded-xl shadow-md space-y-4 border border-gray-200 relative">
        <h2 className="text-xl font-bold text-gray-800">Finance Controls</h2>

        {/* Reset button in top-right corner */}
        <button
          onClick={handleReset}
          className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow transition-all"
        >
          Reset
        </button>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Initial Balances */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <FaDollarSign /> Initial Balances
            </div>
            <input type="number" placeholder="Cash" value={cash} onChange={(e) => setCash(e.target.value)} className="border p-2 rounded w-full" />
            <input type="number" placeholder="Capital" value={capital} onChange={(e) => setCapital(e.target.value)} className="border p-2 rounded w-full" />
            <button onClick={() => handleTransaction("initBalances")} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-semibold transition-all">
              Set
            </button>
          </div>

          {/* Expense */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <FaMoneyBillWave /> Expense
            </div>
            <input type="number" placeholder="Amount" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="border p-2 rounded w-full" />
            <input type="text" placeholder="Name" value={expenseName} onChange={(e) => setExpenseName(e.target.value)} className="border p-2 rounded w-full" />
            <button onClick={() => handleTransaction("expense")} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold transition-all">
              Upload
            </button>
          </div>

          {/* Commission Test */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <FaFileInvoiceDollar /> Commission Test
            </div>
            <button onClick={() => handleTransaction("commissionTest")} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded font-semibold transition-all">
              Run
            </button>
          </div>

          {/* Close Commission */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <FaTachometerAlt /> Close Commission
            </div>
            <button onClick={() => handleTransaction("commissionClose")} className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded font-semibold transition-all">
              Execute
            </button>
          </div>
        </div>

        {message && <div className="text-sm text-gray-600 font-medium mt-2">{message}</div>}
      </div>
    );
  };

  const navItems = [
    { name: "Salary Dashboard", path: "/salary-dashboard", icon: <FaTachometerAlt /> },
    { name: "All Summaries", path: "/summary-table", icon: <FaFileInvoiceDollar /> },
    { name: "Expense Manager", path: "/expense-manager", icon: <FaMoneyBillWave /> },
    { name: "Rules / Breakups", path: "/rules", icon: <FaDollarSign /> },
  ];

  if (loading) return <Loader />;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="sticky top-0 h-screen">
        <Sidebar navItems={navItems} title="Summaries" />
      </div>

      <main className="flex-1 p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Account Summaries</h1>
          <button onClick={fetchAll} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition-colors">
            Refresh
          </button>
        </header>

        <FinanceControls />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {summaries.map((summary) => (
            <section key={summary._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{summary.name}</h2>
                  <div className="text-xs text-gray-500 mt-0.5">Code: {summary.summaryId}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Start</div>
                  <div className="font-semibold text-blue-700">{formatCurrency(summary.startingBalance)}</div>
                  <div className="text-xs text-gray-500 mt-1">End</div>
                  <div className="font-bold text-gray-800">{formatCurrency(summary.endingBalance)}</div>
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium text-sm text-gray-700">Field Lines</h3>
                  <div className="text-xs text-gray-400">Debit / Credit view</div>
                </div>

                {summary.fieldLines?.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left text-xs text-gray-500">Name</th>
                          <th className="p-2 text-left text-xs text-gray-500">Account #</th>
                          <th className="p-2 text-center text-xs text-gray-500">+ / -</th>
                          <th className="p-2 text-right text-xs text-gray-500">Debit</th>
                          <th className="p-2 text-right text-xs text-gray-500">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.fieldLines.map((line, idx) => {
                          const { debit, credit, sign } = getLineDebitCredit(Number(summary.summaryId || summary.summaryNumericId), line);
                          return (
                            <tr key={`${summary._id}-${line.fieldLineNumericId}-${idx}`} className="border-b last:border-b-0">
                              <td className="p-2 align-top text-sm font-medium text-gray-800">{line.name}</td>
                              <td className="p-2 align-top text-xs text-gray-500">{line.fieldLineNumericId || line.accountNumber || "-"}</td>
                              <td className="p-2 text-center align-top">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sign === "+" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{sign}</span>
                              </td>
                              <td className="p-2 text-right align-top">{renderAmountCell(debit, true)}</td>
                              <td className="p-2 text-right align-top">{renderAmountCell(credit, false)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic">No field lines for this summary.</div>
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

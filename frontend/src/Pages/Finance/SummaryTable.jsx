import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar.jsx";
import api from "../../api/axios.js";
import { FaDollarSign, FaMoneyBillWave, FaFileInvoiceDollar, FaTachometerAlt } from "react-icons/fa";

// Loader
const Loader = () => (
  <div className="flex justify-center items-center min-h-[40vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

// Format PKR
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR" }).format(amount || 0);

// Counterparty map
const counterMap = {
  Cash: "Commission Income",
  "Commission Income": "Cash",
  Expense: "Cash",
  Capital: "Cash",
  Salary: "Cash",
};

// ----------------- Finance Controls -----------------
const FinanceControls = ({ fetchAll, setMessage, balances }) => {
  const [cash, setCash] = useState("");
  const [capital, setCapital] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [commissionDesc, setCommissionDesc] = useState("");

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
          payload = {
            cashAmount: parseFloat(cash) || 0,
            capitalAmount: parseFloat(capital) || 0,
          };
          endpoint = "/summaries/init-capital-cash";
          break;

        case "expense":
          payload = {
            amount: parseFloat(expenseAmount) || 0,
            name: expenseName,
          };
          endpoint = "/transactions/expense";
          break;

        case "commissionAdd":
          payload = {
            amount: parseFloat(commissionAmount) || 0,
            description: commissionDesc,
          };
          endpoint = "/transactions/commission/test";
          break;

        case "commissionClose":
          endpoint = "/transactions/commission/close-to-retained";
          break;

        case "retainedToCapital":
          endpoint = "/transactions/transfer-retained-to-capital";
          break;

        default:
          return;
      }

      const res = await api.post(endpoint, payload);
      setMessage(res.data.message || "Transaction completed ✅");
      fetchAll();
    } catch (err) {
      setMessage("Error: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="p-6 mb-6 bg-gray-50 rounded-xl shadow-md border border-gray-200 relative">
      <h2 className="text-xl font-bold text-gray-800">Finance Controls</h2>

      <button
        onClick={handleReset}
        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-xs font-semibold shadow transition-all"
      >
        Reset
      </button>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {/* Initial Balances */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <FaDollarSign /> Initial Balances
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Cash"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            className="border p-2 rounded w-full"
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Capital"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            className="border p-2 rounded w-full"
          />
          <button
            onClick={() => handleTransaction("initBalances")}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-semibold transition-all"
          >
            Set
          </button>
        </div>

        {/* Expense */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <FaMoneyBillWave /> Expense
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Amount"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            className="border p-2 rounded w-full"
          />
          <input
            type="text"
            placeholder="Name"
            value={expenseName}
            onChange={(e) => setExpenseName(e.target.value)}
            className="border p-2 rounded w-full"
          />
          <button
            onClick={() => handleTransaction("expense")}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold transition-all"
          >
            Upload
          </button>
        </div>

        {/* Add Commission */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <FaFileInvoiceDollar /> Add Commission
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Amount"
            value={commissionAmount}
            onChange={(e) => setCommissionAmount(e.target.value)}
            className="border p-2 rounded w-full"
          />
          <input
            type="text"
            placeholder="Description"
            value={commissionDesc}
            onChange={(e) => setCommissionDesc(e.target.value)}
            className="border p-2 rounded w-full"
          />
          <button
            onClick={() => handleTransaction("commissionAdd")}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-semibold transition-all"
          >
            Post Commission
          </button>
        </div>

        {/* Close Commission → Retained */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <FaTachometerAlt /> Close Commission
          </div>
          <button
            onClick={() => handleTransaction("commissionClose")}
            disabled={balances?.commission <= 0}
            className={`px-4 py-2 rounded font-semibold transition-all ${
              balances?.commission > 0
                ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
          >
            Close Commission
          </button>
        </div>

       {/* Retained → Capital */}
<div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col gap-2">
  <div className="flex items-center gap-2 text-gray-700 font-semibold">
    <FaDollarSign /> Retained → Capital
  </div>
  <button
    onClick={() => handleTransaction("retainedToCapital")}
    disabled={balances?.retained === 0} // allow negative or positive
    className={`px-4 py-2 rounded font-semibold transition-all ${
      balances?.retained !== 0
        ? "bg-teal-500 hover:bg-teal-600 text-white"
        : "bg-gray-300 text-gray-600 cursor-not-allowed"
    }`}
  >
    Transfer
  </button>
  {balances?.retained !== 0 && (
    <div className="text-xs text-gray-500 mt-1">
      {`Available: ${formatCurrency(Math.abs(balances.retained))}`}
    </div>
  )}
</div>
      </div>
    </div>
  );
};

// ----------------- SummaryManager -----------------
export default function SummaryManager() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");

  const [balances, setBalances] = useState({
    commission: 0,
    retained: 0,
    capital: 0,
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/summaries/with-fieldlines");
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];

      // normalize
      const normalized = data.map((s) => ({
        ...s,
        fieldLines: (s.fieldLines || []).map((fl) => ({
          ...fl,
          fieldLineNumericId: Number(fl.fieldLineNumericId || fl.accountNumber || fl.fieldLineId),
          name: fl.name || fl.definition?.name || "Unnamed Line",
        })),
      }));

      // set balances
      let commission = 0,
        retained = 0,
        capital = 0;
      normalized.forEach((s) => {
        s.fieldLines.forEach((fl) => {
          if (fl.fieldLineNumericId === 5301) commission += fl.balance || 0;
          if (fl.fieldLineNumericId === 5401) retained += fl.balance || 0;
          if (fl.fieldLineNumericId === 5101) capital += fl.balance || 0;
        });
      });

      setBalances({ commission, retained, capital });
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
          <button
            onClick={fetchAll}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </header>

        <FinanceControls fetchAll={fetchAll} setMessage={setMessage} balances={balances} />

        {message && <div className="text-sm text-gray-600 font-medium">{message}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {summaries.map((summary) => (
            <section
              key={summary._id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
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
                  <h3 className="font-medium text-sm text-gray-700">Entries (Debit / Credit)</h3>
                </div>

                {summary.fieldLines?.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left text-xs text-gray-500">Field Line</th>
                          <th className="p-2 text-left text-xs text-gray-500">Balance</th>
                          <th className="p-2 text-left text-xs text-gray-500">Debit</th>
                          <th className="p-2 text-left text-xs text-gray-500">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.fieldLines.map((line, idx) => (
                          <tr key={`${summary._id}-${line.fieldLineNumericId}-${idx}`} className="border-b last:border-b-0">
                            <td className="p-2 font-medium text-gray-700">
                              {line.name}
                              {counterMap[summary.name] && (
                                <span className="ml-2 text-xs text-gray-500 italic">↔ {counterMap[summary.name]}</span>
                              )}
                            </td>
                            <td className="p-2 font-semibold text-blue-700">{formatCurrency(line.balance)}</td>
                            <td className="p-2 align-top">{line.balance > 0 ? formatCurrency(line.balance) : "—"}</td>
                            <td className="p-2 align-top">{line.balance < 0 ? formatCurrency(Math.abs(line.balance)) : "—"}</td>
                          </tr>
                        ))}
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

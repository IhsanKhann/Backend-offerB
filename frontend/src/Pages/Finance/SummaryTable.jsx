import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar.jsx";
import api from "../../api/axios.js";
import FieldLineManager from "../../components/Enteries.jsx";
import { FaDollarSign, FaMoneyBillWave, FaFileInvoiceDollar, FaTachometerAlt, FaUndo, FaExchangeAlt ,FaPlus} from "react-icons/fa";
import { Table, SplitSquareVertical } from "lucide-react";

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

// Transaction Type Badge
const TransactionTypeBadge = ({ type, isReturn }) => {
  if (isReturn) {
    return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Return</span>;
  }
  return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">{type || 'Order'}</span>;
};

// Balance Display Component
const BalanceDisplay = ({ label, amount, isReturn = false }) => (
  <div className={`p-3 rounded-lg border ${isReturn ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
    <div className="text-sm font-medium text-gray-600">{label}</div>
    <div className={`text-lg font-bold ${isReturn ? 'text-red-700' : 'text-blue-700'}`}>
      {formatCurrency(amount)}
    </div>
  </div>
);

// ----------------- Finance Controls -----------------
const FinanceControls = ({ fetchAll, setMessage, balances, onShowReturns }) => {
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

      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={onShowReturns}
          className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-md text-xs font-semibold shadow transition-all flex items-center gap-1"
        >
          <FaUndo className="text-xs" /> View Returns
        </button>
        <button
          onClick={handleReset}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-xs font-semibold shadow transition-all"
        >
          Reset All
        </button>
      </div>

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
            <FaExchangeAlt /> Retained → Capital
          </div>
          <button
            onClick={() => handleTransaction("retainedToCapital")}
            disabled={balances?.retained === 0}
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
  const [showReturns, setShowReturns] = useState(false);
  const [returnData, setReturnData] = useState([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSummary, setNewSummary] = useState({
    summaryId: "",
    name: "",
    accountType: "asset",
    parentId: "",
    startingBalance: 0,
  });

  const [balances, setBalances] = useState({
    commission: 0,
    retained: 0,
    capital: 0,
    netPosition: 0,
  });

  const [summaryOptions, setSummaryOptions] = useState([]);
  const [selectedSummary, setSelectedSummary] = useState("");

  // Fetch summaries from backend with better error handling
  const fetchSummaryOptions = async () => {
    try {
      const res = await api.get("/summaries");
      console.log("Summary options response:", res.data); // Debug log
      
      // Handle different response structures
      let options = [];
      if (Array.isArray(res.data)) {
        options = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        options = res.data.data;
      } else if (res.data && Array.isArray(res.data.summaries)) {
        options = res.data.summaries;
      } else {
        console.warn("Unexpected response structure:", res.data);
        options = [];
      }
      
      setSummaryOptions(options);
    } catch (err) {
      console.error("Failed to fetch summaries", err);
      setSummaryOptions([]); // Ensure it's always an array
    }
  };

  // Call this once when component mounts
  useEffect(() => {
    fetchSummaryOptions();
  }, []);

const handleDeleteSelected = async () => {
  if (!selectedSummary) return alert("Select a summary first");
  if (!window.confirm("Are you sure you want to delete this summary?")) return;

  try {
    // Send the MongoDB _id directly
    const res = await api.post("/summaries/delete", { summaryId: selectedSummary });
    setMessage(res.data.message || "Summary deleted successfully ✅");
    setSelectedSummary("");
    fetchAll();           // refresh summaries display
    fetchSummaryOptions(); // refresh dropdown
  } catch (err) {
    console.error("Delete failed:", err);
    setMessage("Error deleting summary: " + (err.response?.data?.error || err.message));
  }
};

  // ----------------- Create Summary ----------------- // working
  const handleCreateSummary = async () => {
    try {
      const payload = {
        summaryId: Number(newSummary.summaryId),
        name: newSummary.name,
        accountType: newSummary.accountType,
        parentId: newSummary.parentId ? Number(newSummary.parentId) : null,
        startingBalance: Number(newSummary.startingBalance),
      };

      const res = await api.post("/summaries/create", payload);
      setMessage(res.data.message || "Summary created successfully ✅");
      setShowCreateModal(false);
      setNewSummary({ summaryId: "", name: "", accountType: "asset", parentId: "", startingBalance: 0 });
      fetchAll();
    } catch (err) {
      console.error("Create summary failed:", err);
      setMessage("Error creating summary: " + (err.response?.data?.message || err.message));
    }
  };

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
      let commission = 0, retained = 0, capital = 0, netPosition = 0;
      normalized.forEach((s) => {
        s.fieldLines.forEach((fl) => {
          if (fl.fieldLineNumericId === 5301) commission += fl.balance || 0;
          if (fl.fieldLineNumericId === 5401) retained += fl.balance || 0;
          if (fl.fieldLineNumericId === 5101) capital += fl.balance || 0;
          netPosition += fl.balance || 0;
        });
      });

      setBalances({ commission, retained, capital, netPosition });
      setSummaries(normalized);

      // Fetch return data if showing returns
      if (showReturns) {
        await fetchReturnData();
      }
    } catch (err) {
      console.error("Failed to fetch summaries", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [showReturns]);

  const fetchReturnData = async () => {
    try {
      const res = await api.get("/transactions/returns");
      setReturnData(res.data || []);
    } catch (err) {
      console.error("Failed to fetch return data", err);
      setReturnData([]);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleReturnsView = () => {
    setShowReturns(!showReturns);
    if (!showReturns) {
      fetchReturnData();
    }
  };

  const navItems = [
    { name: "Salary Dashboard", path: "/salary-dashboard"},
    { name: "All Summaries", path: "/summary-table"},
    { name: "Non-Business Tables", path: "/tables" },
    { name: "Business Breakup Tables", path: "/BussinessBreakupTables" },
    { name: "Salary Rules", path: "/salary/rulesTable" },
    { name: "Testing", path: "/paymentDashboard"},
  ];

  if (loading) return <Loader />;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  // Safe array check before mapping
  const safeSummaryOptions = Array.isArray(summaryOptions) ? summaryOptions : [];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="sticky top-0 h-screen">
        <Sidebar navItems={navItems} title="Summaries" />
      </div>

      <main className="flex-1 p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            {showReturns ? "Return Transactions" : "Account Summaries"}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={toggleReturnsView}
              className={`px-4 py-2 rounded font-semibold transition-all ${
                showReturns 
                  ? "bg-gray-600 hover:bg-gray-700 text-white" 
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
            >
              {showReturns ? "Show Summaries" : "Show Returns"}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow flex items-center gap-1"
            >
              <FaPlus /> Add Summary
            </button>
          </div>
        </header>

        {/* Delete Summary Section */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Delete Summary</h2>
          <div className="flex gap-3 items-center flex-wrap">
            <select
              value={selectedSummary}
              onChange={(e) => setSelectedSummary(e.target.value)}
              className="border p-2 rounded w-60"
            >
              <option value="">-- Select Summary --</option>
              {safeSummaryOptions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name || "Unnamed"}
                </option>
              ))}
            </select>
            <button
              onClick={handleDeleteSelected}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold text-sm"
            >
              Delete
            </button>
            <button
              onClick={fetchSummaryOptions}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        <FieldLineManager summaries={summaryOptions} fetchAll={fetchAll} />
        
        <FinanceControls 
          fetchAll={fetchAll} 
          setMessage={setMessage} 
          balances={balances}
          onShowReturns={toggleReturnsView}
        />

        {message && <div className="text-sm text-gray-600 font-medium">{message}</div>}

        {/* ----------- Create Summary Modal ----------- */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
              <h2 className="text-xl font-bold mb-4">Create New Summary</h2>
              <div className="flex flex-col gap-3">
                <input
                  type="number"
                  placeholder="Summary ID"
                  value={newSummary.summaryId}
                  onChange={(e) => setNewSummary({ ...newSummary, summaryId: e.target.value })}
                  className="border p-2 rounded w-full"
                />
                <input
                  type="text"
                  placeholder="Name"
                  value={newSummary.name}
                  onChange={(e) => setNewSummary({ ...newSummary, name: e.target.value })}
                  className="border p-2 rounded w-full"
                />
                <select
                  value={newSummary.accountType}
                  onChange={(e) => setNewSummary({ ...newSummary, accountType: e.target.value })}
                  className="border p-2 rounded w-full"
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="equity">Equity</option>
                </select>
                <input
                  type="number"
                  placeholder="Parent ID (optional)"
                  value={newSummary.parentId}
                  onChange={(e) => setNewSummary({ ...newSummary, parentId: e.target.value })}
                  className="border p-2 rounded w-full"
                />
                <input
                  type="number"
                  placeholder="Starting Balance"
                  value={newSummary.startingBalance}
                  onChange={(e) => setNewSummary({ ...newSummary, startingBalance: e.target.value })}
                  className="border p-2 rounded w-full"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSummary}
                    className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Net Position Display */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BalanceDisplay label="Commission Balance" amount={balances.commission} />
          <BalanceDisplay label="Retained Earnings" amount={balances.retained} />
          <BalanceDisplay label="Capital" amount={balances.capital} />
          <BalanceDisplay 
            label="Net Position" 
            amount={balances.netPosition} 
            isReturn={balances.netPosition < 0}
          />
        </div>

        {showReturns ? (
          /* Returns View */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Return Transactions</h2>
              <p className="text-sm text-gray-600 mt-1">All processed returns and their effects</p>
            </div>
            
            <div className="p-6">
              {returnData.length > 0 ? (
                <div className="space-y-4">
                  {returnData.map((returnItem, index) => (
                    <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-red-800">
                            Return for Order: {returnItem.orderId}
                          </h3>
                          <p className="text-sm text-red-600">
                            Amount: {formatCurrency(returnItem.amount)} | 
                            Date: {new Date(returnItem.returnDate).toLocaleDateString()}
                          </p>
                        </div>
                        <TransactionTypeBadge isReturn={true} />
                      </div>
                      
                      {returnItem.lines && returnItem.lines.length > 0 && (
                        <div className="mt-3 text-sm">
                          <h4 className="font-medium text-red-700">Reversal Entries:</h4>
                          <ul className="mt-1 space-y-1">
                            {returnItem.lines.slice(0, 3).map((line, idx) => (
                              <li key={idx} className="text-red-600">
                                {line.componentName}: {formatCurrency(line.value)} ({line.debitOrCredit})
                              </li>
                            ))}
                            {returnItem.lines.length > 3 && (
                              <li className="text-red-500 italic">
                                +{returnItem.lines.length - 3} more entries...
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FaUndo className="text-4xl mx-auto mb-3 text-gray-300" />
                  <p>No return transactions found</p>
                  <p className="text-sm">Returns will appear here when processed</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Summaries View */
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
                    {summary.breakupType === 'return' && (
                      <TransactionTypeBadge isReturn={true} />
                    )}
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
        )}
      </main>
    </div>
  );
}
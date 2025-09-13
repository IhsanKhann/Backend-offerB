import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar.jsx";
import api from "../../api/axios.js";

// currency formatter
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
  }).format(amount || 0);

export default function SummaryWithEntries() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const res = await api.get("/summaries/with-entries");
        setSummaries(res.data || []);
      } catch (err) {
        console.error("Error fetching summaries:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummaries();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin h-10 w-10 border-b-2 border-blue-500 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar title="Summaries with Entries" navItems={[]} />

      <main className="flex-1 p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Account Summaries (with Counterparties)
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {summaries.map((summary) => (
            <section
              key={summary.summaryId}
              className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">
                  {summary.summaryName}
                </h2>
                <div className="text-xs text-gray-500">ID: {summary.summaryId}</div>
              </div>

              {/* Entries table */}
              <div className="p-4">
                {summary.lines?.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left text-xs text-gray-500">
                            Date
                          </th>
                          <th className="p-2 text-left text-xs text-gray-500">
                            Description
                          </th>
                          <th className="p-2 text-left text-xs text-gray-500">
                            Debit
                          </th>
                          <th className="p-2 text-left text-xs text-gray-500">
                            Credit
                          </th>
                          <th className="p-2 text-left text-xs text-gray-500">
                            Counterparties
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.lines.map((line, idx) => (
                          <tr
                            key={`${summary.summaryId}-${idx}`}
                            className="border-b last:border-b-0"
                          >
                            <td className="p-2 text-xs text-gray-500">
                              {new Date(line.date).toLocaleDateString()}
                            </td>
                            <td className="p-2">{line.description}</td>
                            <td className="p-2 text-green-700 font-medium">
                              {line.debitOrCredit === "debit"
                                ? formatCurrency(line.amount)
                                : "—"}
                            </td>
                            <td className="p-2 text-red-700 font-medium">
                              {line.debitOrCredit === "credit"
                                ? formatCurrency(line.amount)
                                : "—"}
                            </td>
                            <td className="p-2 text-xs text-gray-600">
                              {line.counterparties.map((cp, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between gap-2 border-b last:border-b-0 py-1"
                                >
                                  <span>{cp.summaryName}</span>
                                  <span
                                    className={
                                      cp.debitOrCredit === "debit"
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    {cp.debitOrCredit === "debit" ? "+" : "-"}
                                    {formatCurrency(cp.amount)}
                                  </span>
                                </div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic">
                    No entries for this summary.
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

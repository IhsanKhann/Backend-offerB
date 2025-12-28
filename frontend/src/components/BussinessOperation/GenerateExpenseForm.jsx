import React, { useState } from "react";
import api from "../../api/axios.js";
import CycleModal from "./CycleModal.jsx";
import PayExpenseForm from "./PayExpenseForm.jsx";

const GenerateExpenseForm = ({ refresh }) => {
  const [months, setMonths] = useState([]);
  const [cycleId, setCycleId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cycleModalOpen, setCycleModalOpen] = useState(false);

  const generateByMonths = async () => {
    console.log("🟦 Generating by months:", months);
    setLoading(true);
    await api.post("/expenseReports/generate-Reports-ByMonths", { months });
    refresh();
    setLoading(false);
  };

  const generateByCycle = async () => {
    console.log("🟩 Generating by cycle:", cycleId);
    setLoading(true);
    await api.post("/expenseReports/cycle", { cycleId });
    refresh();
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-xl shadow">

      {/* MONTHLY */}
      <div>
        <h3 className="font-bold mb-2">Generate by Months</h3>
        <input type="month" onChange={e =>
          setMonths(prev => [...prev, e.target.value])
        } />
        <button onClick={generateByMonths} className="btn-primary mt-3">
          Generate
        </button>
      </div>

      {/* CYCLE */}
      <div>
        <h3 className="font-bold mb-2">Generate by Cycle</h3>
        <button onClick={() => setCycleModalOpen(true)} className="btn-green">
          Select Cycle
        </button>

        {cycleId && (
          <button onClick={generateByCycle} className="btn-purple mt-3">
            Generate
          </button>
        )}
      </div>

      {/* PAY */}
      <PayExpenseForm refresh={refresh} />

      {cycleModalOpen && (
        <CycleModal
          onClose={() => setCycleModalOpen(false)}
          onSuccess={id => {
            console.log("✅ Cycle selected:", id);
            setCycleId(id);
            setCycleModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default GenerateExpenseForm;

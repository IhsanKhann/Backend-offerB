import React, { useState } from "react";
import api from "../../api/axios.js";

const PayExpenseForm = ({ refresh }) => {
  const [fromDate, setFrom] = useState("");
  const [toDate, setTo] = useState("");

  const pay = async () => {
    console.log("💸 Paying expenses:", fromDate, toDate);
    await api.post("/expenseReports/PayExpensesLater", {
      fromDate,
      toDate,
      periodKey: `${fromDate}_${toDate}`
    });
    refresh();
  };

  return (
    <div>
      <h3 className="font-bold mb-2">Pay Expenses</h3>

      <input type="date" onChange={e => setFrom(e.target.value)} />
      <input type="date" onChange={e => setTo(e.target.value)} />

      <button onClick={pay} className="btn-red mt-3">
        Pay
      </button>
    </div>
  );
};

export default PayExpenseForm;

import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";

const AccountStatements = () => {
  const [statements, setStatements] = useState([]);
  const [selected, setSelected] = useState([]);

  const fetchStatements = async () => {
    const res = await api.get("/statements?status=pending");
    setStatements(res.data.data);
  };

  const sendToBusiness = async () => {
    await api.post("/statements/send", { ids: selected });
    alert("Sent to business successfully!");
    fetchStatements();
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Pending Account Statements</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statements.map((st) => (
          <div
            key={st._id}
            className="p-4 bg-white rounded-xl shadow hover:shadow-md"
          >
            <p className="font-semibold">Seller: {st.sellerName}</p>
            <p className="text-sm text-gray-600">
              Period: {st.startDate} → {st.endDate}
            </p>
            <p className="text-sm text-gray-500">Status: {st.status}</p>
            <button
              onClick={() =>
                setSelected((prev) =>
                  prev.includes(st._id)
                    ? prev.filter((id) => id !== st._id)
                    : [...prev, st._id]
                )
              }
              className={`mt-2 px-3 py-1 rounded-md ${
                selected.includes(st._id)
                  ? "bg-green-600 text-white"
                  : "bg-gray-100"
              }`}
            >
              {selected.includes(st._id) ? "Selected" : "Select"}
            </button>
          </div>
        ))}
      </div>
      {selected.length > 0 && (
        <button
          onClick={sendToBusiness}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md"
        >
          Send to Business ({selected.length})
        </button>
      )}
    </div>
  );
};

export default AccountStatements;
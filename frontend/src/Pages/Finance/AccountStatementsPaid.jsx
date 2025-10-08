import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";

const PaidStatements = () => {
  const [statements, setStatements] = useState([]);

  useEffect(() => {
    api.get("/statements?status=paid").then((res) => setStatements(res.data.data));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Paid Account Statements</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statements.map((st) => (
          <div
            key={st._id}
            className="p-4 bg-gray-200 rounded-xl shadow relative"
          >
            <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
              PAID
            </div>
            <p className="font-semibold">Seller: {st.sellerName}</p>
            <p className="text-sm text-gray-600">
              Period: {st.startDate} → {st.endDate}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default PaidStatements;
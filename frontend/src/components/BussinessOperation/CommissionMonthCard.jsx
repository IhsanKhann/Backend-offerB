import React from "react";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function CommissionMonthCard({ data }) {
  const { month, readyForCommission, waitingForReturn, settled } = data;

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="text-lg font-semibold mb-4">{month}</h2>

      <div className="grid grid-cols-3 gap-4">
        <Stat
          icon={<AlertTriangle className="text-orange-500" />}
          label="Ready for Commission"
          value={readyForCommission.length}
        />
        <Stat
          icon={<Clock className="text-blue-500" />}
          label="Waiting for Return"
          value={waitingForReturn.length}
        />
        <Stat
          icon={<CheckCircle className="text-green-600" />}
          label="Settled"
          value={settled.length}
        />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 border rounded-lg p-3">
      {icon}
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

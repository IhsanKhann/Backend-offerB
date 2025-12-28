import React from "react";
import { FileText, CheckCircle, Lock, Hash, User } from "lucide-react";

export default function CommissionReportCard({ report }) {
  const isSettled = report.status === "settled";

  return (
    <div className="bg-white rounded-xl shadow p-5">
      {/* ===============================
          HEADER
      =============================== */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <FileText className="text-gray-600" size={18} />
          <div>
            <h3 className="font-semibold text-lg">
              Period: {report.periodKey}
            </h3>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Hash size={12} />
              {shortId(report._id)}
            </p>
          </div>
        </div>

        {isSettled ? (
          <StatusBadge
            label="Settled"
            icon={<CheckCircle size={14} />}
            className="bg-green-100 text-green-700"
          />
        ) : (
          <StatusBadge
            label="Locked"
            icon={<Lock size={14} />}
            className="bg-orange-100 text-orange-700"
          />
        )}
      </div>

      {/* ===============================
          BODY
      =============================== */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <Info label="From Date" value={formatDate(report.fromDate)} />
        <Info label="To Date" value={formatDate(report.toDate)} />

        <Info
          label="Commission Amount"
          value={formatAmount(report.commissionAmount)}
          bold
        />
        <Info
          label="Expense Amount"
          value={formatAmount(report.expenseAmount || 0)}
        />

        <Info
          label="Net Result"
          value={formatAmount(report.netResult || 0)}
          highlight={report.resultType}
          bold
        />
        <Info
          label="Capital Impact"
          value={formatAmount(report.capitalImpactAmount || 0)}
        />

        <Info label="Result Type" value={capitalize(report.resultType)} />
        <Info
          label="Commission Txns"
          value={report.commissionTransactionIds?.length || 0}
        />
      </div>

      {/* ===============================
          FOOTER (AUDIT INFO)
      =============================== */}
      <div className="mt-4 pt-3 border-t text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>Created At</span>
          <span>{formatDateTime(report.createdAt)}</span>
        </div>

        <div className="flex justify-between">
          <span className="flex items-center gap-1">
            <User size={12} /> Closed By
          </span>
          <span>{shortId(report.closedBy)}</span>
        </div>

        <div className="flex justify-between">
          <span>Closed At</span>
          <span>{formatDateTime(report.closedAt)}</span>
        </div>

        {isSettled && (
          <div className="flex justify-between">
            <span>Settled At</span>
            <span>{formatDateTime(report.settledAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===============================
   SMALL UI HELPERS
================================ */

function Info({ label, value, bold, highlight }) {
  let color = "text-gray-800";
  if (highlight === "profit") color = "text-green-700";
  if (highlight === "loss") color = "text-red-600";

  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className={`${color} ${bold ? "font-semibold" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ label, icon, className }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}

/* ===============================
   FORMATTERS
================================ */

function formatDate(date) {
  return date ? new Date(date).toLocaleDateString() : "—";
}

function formatDateTime(date) {
  return date ? new Date(date).toLocaleString() : "—";
}

function formatAmount(val) {
  if (val == null) return "0";

  // Mongo Decimal128
  if (typeof val === "object" && "$numberDecimal" in val) {
    return Number(val.$numberDecimal).toLocaleString();
  }

  // Mongoose Decimal128 instance
  if (typeof val === "object" && typeof val.toString === "function") {
    return Number(val.toString()).toLocaleString();
  }

  return Number(val).toLocaleString();
}

function shortId(id) {
  if (!id) return "—";
  return id.toString().slice(-6);
}

function capitalize(str) {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

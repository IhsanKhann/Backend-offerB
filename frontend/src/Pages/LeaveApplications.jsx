// src/pages/LeaveApplications.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";

const LeaveApplications = () => {
  const [loading, setLoading] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [rejectModal, setRejectModal] = useState({ open: false, employeeId: null, reason: "" });
  const [transferState, setTransferState] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [leavesRes, allRes] = await Promise.all([
        api.get("/leaves/all"),
        api.get("/finalizedEmployees/all"),
      ]);
      setLeaves(leavesRes?.data?.data || []);
      setAllEmployees((allRes?.data?.data || []).filter(e => !e?.leave?.onLeave));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const acceptLeave = async (employeeId) => {
    try {
      setLeaves(prev => prev.map(e => e._id === employeeId
        ? { ...e, leave: { ...e.leave, leaveAcccepted: true, leaveRejected: false } }
        : e
      ));
      await api.post(`/leaves/${employeeId}/accept`);
    } catch (err) {
      console.error(err);
      await loadData();
    }
  };

  const openRejectModal = (employeeId) => setRejectModal({ open: true, employeeId, reason: "" });
  const closeRejectModal = () => setRejectModal({ open: false, employeeId: null, reason: "" });

  const submitReject = async () => {
    const { employeeId, reason } = rejectModal;
    if (!reason.trim()) return;
    try {
      await api.post(`/leaves/${employeeId}/reject`, { reason });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      closeRejectModal();
    }
  };

  const deleteLeaveApplication = async (employeeId) => {
    try {
      await api.delete(`/leaves/delete/${employeeId}`);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const setTransferTarget = (employeeId, targetEmployeeId) => {
    setTransferState(prev => ({ ...prev, [employeeId]: targetEmployeeId }));
  };

  const doTransfer = async (employeeId) => {
    const targetEmployeeId = transferState[employeeId];
    if (!targetEmployeeId) return;

    try {
      await api.post(`/leaves/${employeeId}/transfer`, { targetEmployeeId });
    } catch (err) {
      console.error(err);
    }
  };

  // Leave status helper
  const leaveStatus = (leave) => {
    if (leave?.leaveRejected) return "Rejected";
    if (leave?.leaveAcccepted) return "Accepted";
    if (leave?.onLeave) return "Pending";
    return "Not Applied";
  };

  const EmployeeCard = ({ emp }) => {
    const leave = emp?.leave || {};
    const start = leave?.leaveStartDate ? new Date(leave.leaveStartDate).toLocaleDateString() : "-";
    const end = leave?.leaveEndDate ? new Date(leave.leaveEndDate).toLocaleDateString() : "-";

    return (
      <div className="bg-white rounded-2xl shadow p-4 md:p-6 w-full">
        <div className="flex items-start justify-between gap-2">
          <div>
            <img src={emp?.avatar?.url || ""} alt={emp?.individualName} className="w-16 h-16 object-cover rounded-full" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{emp?.individualName || "(No name)"}</h3>
            <p className="text-sm text-gray-600">
              {emp?.role?.name || "(Role)"} {emp?.orgUnit?.name ? `• ${emp.orgUnit.name}` : ""}
            </p>
            <p className="text-sm text-gray-600">{emp.officialEmail}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => acceptLeave(emp._id)} className="px-3 py-1.5 rounded-xl bg-green-600 text-white text-sm hover:bg-green-700">
              Accept
            </button>
            <button onClick={() => openRejectModal(emp._id)} className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-sm hover:bg-red-700">
              Reject
            </button>
            <button onClick={() => deleteLeaveApplication(emp._id)} className="px-3 py-1.5 rounded-xl bg-gray-500 text-white text-sm hover:bg-gray-600">
              Delete
            </button>
          </div>
        </div>

        {/* Transfer */}
        <div className="flex items-center gap-2 mt-3">
          <select className="border rounded-xl px-2 py-1 text-sm" value={transferState[emp._id] || ""} onChange={(e) => setTransferTarget(emp._id, e.target.value)}>
            <option value="">Transfer to…</option>
            {allEmployees.map(e => <option key={e._id} value={e._id}>{e.individualName}</option>)}
          </select>
          <button onClick={() => doTransfer(emp._id)} className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50" disabled={!transferState[emp._id]}>
            Transfer
          </button>
        </div>

        {/* Leave Details */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Type</p>
            <p className="text-sm font-medium">{leave?.leaveType || "-"}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Dates</p>
            <p className="text-sm font-medium">{start} → {end}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Status</p>
            <p className="text-sm font-medium">{leaveStatus(leave)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Accepted</p>
            <p className="text-sm font-medium">{leave?.leaveAcccepted ? "Yes" : "No"}</p>
          </div>
        </div>

        {leave?.leaveReason && (
          <div className="mt-3">
            <p className="text-xs text-gray-500">Reason</p>
            <p className="text-sm">{leave.leaveReason}</p>
          </div>
        )}

        {(leave?.RejectionLeaveReason || leave?.RejectedBy) && (
          <div className="mt-3 bg-rose-50 rounded-xl p-3 border border-rose-200">
            <p className="text-xs text-rose-600">Rejection</p>
            <p className="text-sm">
              {leave?.RejectionLeaveReason ? `Reason: ${leave.RejectionLeaveReason}` : ""}
              {leave?.RejectedBy ? ` — by ${leave.RejectedBy}` : ""}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Leave Applications</h1>
      {loading && <div className="text-sm text-gray-600">Loading…</div>}
      {!loading && leaves.length === 0 && <div className="text-sm text-gray-600">No employees currently on leave.</div>}
      <div className="flex flex-col gap-4">{leaves.map(emp => <EmployeeCard key={emp._id} emp={emp} />)}</div>

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Reject Leave</h3>
            <textarea rows={4} className="w-full border rounded-xl p-2" placeholder="Enter rejection reason…"
              value={rejectModal.reason} onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))} />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={closeRejectModal} className="px-3 py-1.5 rounded-xl border text-sm">Cancel</button>
              <button onClick={submitReject} className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-sm hover:bg-red-700">Submit Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveApplications;

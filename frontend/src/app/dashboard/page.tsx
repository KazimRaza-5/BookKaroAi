"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/apiClient";
import ConfirmDialog from "@/components/ConfirmDialog";
import RequireAuth from "@/components/RequireAuth";

type Appointment = {
  id: string;
  startTime: string;
  status: string;
  service: { name: string };
  provider: { name: string };
};

type ActionType = "cancel" | "complete" | "delete";
const PAGE_SIZE = 5;

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    CONFIRMED: "bg-emerald-500/15 text-emerald-400",
    CANCELLED: "bg-gray-500/15 text-gray-400",
    COMPLETED: "bg-indigo-500/15 text-indigo-400",
    NO_SHOW: "bg-red-500/15 text-red-400",
  };
  const labels: Record<string, string> = { NO_SHOW: "MISSED" };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${styles[status] || styles.CANCELLED}`}>
      {labels[status] || status}
    </span>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short", hour12: true });
}

function DashboardContent() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [actionTarget, setActionTarget] = useState<{ appt: Appointment; action: ActionType } | null>(null);

  function load() {
    apiFetch("/api/appointments/me").then(setAppointments).catch((e) => setStatus(e.message));
  }
  useEffect(load, []);

  async function handleConfirmAction() {
    if (!actionTarget) return;
    const { appt, action } = actionTarget;
    try {
      if (action === "cancel") await apiFetch(`/api/appointments/${appt.id}`, { method: "DELETE" });
      else if (action === "complete") await apiFetch(`/api/appointments/${appt.id}/complete`, { method: "POST" });
      else if (action === "delete") await apiFetch(`/api/appointments/${appt.id}/permanent`, { method: "DELETE" });
      setActionTarget(null);
      load();
    } catch (e: any) {
      setStatus(e.message);
      setActionTarget(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(appointments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = appointments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const dialogCopy: Record<ActionType, { title: string; confirmLabel: string; tone: "default" | "danger" }> = {
    cancel: { title: "Cancel appointment?", confirmLabel: "Cancel appointment", tone: "danger" },
    complete: { title: "Mark as completed?", confirmLabel: "Mark completed", tone: "default" },
    delete: { title: "Permanently delete this record?", confirmLabel: "Delete permanently", tone: "danger" },
  };

  return (
    <main className="max-w-6xl mx-auto px-8 py-16">
      <h1 className="text-3xl font-semibold text-white mb-10">Your appointments</h1>
      {status && <p className="text-red-400 text-sm mb-4">{status}</p>}

      {appointments.length === 0 ? (
        <p className="text-gray-500">No appointments yet.</p>
      ) : (
        <>
          <div className="border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-base">
              <thead>
                <tr className="bg-white/5 text-gray-400 text-left">
                  <th className="px-6 py-4 font-medium">Service</th>
                  <th className="px-6 py-4 font-medium">Provider</th>
                  <th className="px-6 py-4 font-medium">Date &amp; time</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {pageItems.map((a, i) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.04 }}
                      className={i % 2 === 1 ? "bg-white/[0.02]" : ""}
                    >
                      <td className="px-6 py-5 text-white font-medium">{a.service.name}</td>
                      <td className="px-6 py-5 text-gray-300">{a.provider.name}</td>
                      <td className="px-6 py-5 text-gray-300 whitespace-nowrap">{formatDateTime(a.startTime)}</td>
                      <td className="px-6 py-5">{statusBadge(a.status)}</td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex gap-2 justify-end">
                          {a.status === "CONFIRMED" && (
                            <>
                              <button
                                onClick={() => setActionTarget({ appt: a, action: "complete" })}
                                className="text-indigo-400 text-xs border border-indigo-500/40 rounded-lg px-3 py-1.5 hover:bg-indigo-500/10 transition"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => setActionTarget({ appt: a, action: "cancel" })}
                                className="text-red-400 text-xs border border-red-500/40 rounded-lg px-3 py-1.5 hover:bg-red-500/10 transition"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {a.status !== "CONFIRMED" && (
                            <button
                              onClick={() => setActionTarget({ appt: a, action: "delete" })}
                              className="text-gray-400 text-xs border border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-800 transition"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="text-sm px-4 py-2 rounded-lg border border-gray-800 text-gray-300 disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="text-sm px-4 py-2 rounded-lg border border-gray-800 text-gray-300 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {actionTarget && (
        <ConfirmDialog
          open={true}
          title={dialogCopy[actionTarget.action].title}
          tone={dialogCopy[actionTarget.action].tone}
          message={`${actionTarget.appt.service.name} with ${actionTarget.appt.provider.name} on ${formatDateTime(actionTarget.appt.startTime)}.`}
          confirmLabel={dialogCopy[actionTarget.action].confirmLabel}
          onConfirm={handleConfirmAction}
          onCancel={() => setActionTarget(null)}
        />
      )}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

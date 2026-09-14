"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import RequireAuth from "@/components/RequireAuth";

type Appointment = {
  id: string;
  startTime: string;
  service: { name: string };
  provider: { name: string };
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short", hour12: true });
}

function NotificationsContent() {
  const [missed, setMissed] = useState<Appointment[]>([]);
  const [status, setStatus] = useState("");

    useEffect(() => {
    apiFetch("/api/appointments/notifications")
      .then(setMissed)
      .catch((e) => setStatus(e.message));
    // Visiting this page marks everything currently missed as "seen" —
    // the navbar badge will reflect this on its next fetch.
    apiFetch("/api/appointments/notifications/mark-seen", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold text-white mb-8">Notifications</h1>
      {status && <p className="text-red-400 text-sm mb-4">{status}</p>}

      {missed.length === 0 ? (
        <p className="text-gray-500">No missed appointments — you're all caught up.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {missed.map((a) => (
            <div key={a.id} className="border border-red-500/30 bg-red-500/5 rounded-xl p-4">
              <div className="text-white font-medium">Missed appointment</div>
              <div className="text-sm text-gray-300 mt-1">
                {a.service.name} with {a.provider.name}
              </div>
              <div className="text-sm text-gray-500 mt-1">{formatDateTime(a.startTime)}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  );
}

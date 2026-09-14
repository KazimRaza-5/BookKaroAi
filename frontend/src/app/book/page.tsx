"use client";
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { apiFetch } from "@/lib/apiClient";
import RequireAuth from "@/components/RequireAuth";
import ConfirmDialog from "@/components/ConfirmDialog";

type Service = {
  id: string;
  name: string;
  durationMin: number;
  price: string;
  providerId: string;
  provider: { name: string };
};

function formatSlotTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatSlotDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short", hour12: true });
}

function BookFlow() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    apiFetch("/api/services").then(setServices).catch((e) => setStatus(e.message));
  }, []);

  async function loadSlots() {
    if (!selectedService || !date) return;
    setStatus("");
    setLoadingSlots(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const result = await apiFetch(`/api/appointments/availability?serviceId=${selectedService.id}&date=${dateStr}`);
      setSlots(result);
      if (result.length === 0) setStatus("No slots available on that day — please check another day.");
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function confirmBooking() {
    if (!selectedService || !confirming) return;
    setStatus("");
    try {
      await apiFetch("/api/appointments", {
        method: "POST",
        body: JSON.stringify({ providerId: selectedService.providerId, serviceId: selectedService.id, startTime: confirming }),
      });
      setStatus("Booked! Check your dashboard.");
      setSlots((prev) => prev.filter((s) => s !== confirming));
      setConfirming(null);
    } catch (e: any) {
      setStatus(e.message);
      setConfirming(null);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold text-white mb-10">Book an appointment</h1>

      <section className="mb-10">
        <StepLabel n={1} label="Choose a service" />
        <div className="flex flex-col gap-2 mt-4">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedService(s);
                setSlots([]);
                setStatus("");
              }}
              className={`text-left rounded-xl p-4 border transition ${
                selectedService?.id === s.id
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-gray-800 hover:border-gray-600"
              }`}
            >
              <div className="font-medium text-white">{s.name}</div>
              <div className="text-sm text-gray-400 mt-0.5">
                {s.provider.name} · {s.durationMin} min · ${s.price}
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedService && (
        <section className="mb-10">
          <StepLabel n={2} label="Pick a date" />
          <div className="flex items-center gap-3 mt-4">
            <DatePicker
              selected={date}
              onChange={(d) => setDate(d)}
              minDate={new Date()}
              placeholderText="Select a date"
              dateFormat="MMMM d, yyyy"
              className="border border-gray-800 rounded-lg px-3.5 py-2.5 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={loadSlots}
              disabled={!date || loadingSlots}
              className="bg-indigo-500 hover:bg-indigo-400 transition-colors text-white rounded-lg px-4 py-2.5 font-medium disabled:opacity-40 disabled:hover:bg-indigo-500"
            >
              {loadingSlots ? "Loading…" : "Find slots"}
            </button>
          </div>
        </section>
      )}

      {slots.length > 0 && (
        <section className="mb-10">
          <StepLabel n={3} label="Pick a time" />
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
            {slots.map((slot) => (
              <button
                key={slot}
                onClick={() => setConfirming(slot)}
                className="rounded-lg border border-gray-800 py-2.5 text-sm text-gray-200 hover:border-indigo-500 hover:text-white transition"
              >
                {formatSlotTime(slot)}
              </button>
            ))}
          </div>
        </section>
      )}

      {status && <p className="text-sm text-gray-400 mt-4">{status}</p>}

      <ConfirmDialog
        open={!!confirming}
        title="Confirm booking"
        message={confirming ? `Book ${selectedService?.name} on ${formatSlotDateTime(confirming)}?` : ""}
        confirmLabel="Confirm booking"
        onConfirm={confirmBooking}
        onCancel={() => setConfirming(null)}
      />
    </main>
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-semibold">
        {n}
      </span>
      <h2 className="font-medium text-gray-200">{label}</h2>
    </div>
  );
}

export default function BookPage() {
  return (
    <RequireAuth>
      <BookFlow />
    </RequireAuth>
  );
}

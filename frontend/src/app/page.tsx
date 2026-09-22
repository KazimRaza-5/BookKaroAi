
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const services = await apiFetch("/api/services");
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-semibold text-white mb-3">Book your next appointment</h1>
      <p className="text-gray-400 mb-10">Pick a service below, or jump straight into booking.</p>
      <div className="flex flex-col gap-2 mb-10">
        {services.map((s: any) => (
          <div key={s.id} className="rounded-xl border border-gray-800 p-4">
            <div className="font-medium text-white">{s.name}</div>
            <div className="text-sm text-gray-400 mt-0.5">
              {s.provider.name} · {s.durationMin} min · ${s.price}
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/book"
        className="bg-indigo-500 hover:bg-indigo-400 transition-colors text-white rounded-lg px-5 py-2.5 font-medium inline-block"
      >
        Book an appointment
      </Link>
    </main>
  );
}


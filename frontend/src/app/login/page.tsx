"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { token } = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      login(token);
      router.push("/book");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <main className="max-w-sm mx-auto mt-20 px-6">
      <div className="border border-gray-800 rounded-2xl p-8">
        <h1 className="text-xl font-semibold text-white mb-6">Welcome back</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Email">
            <input
              className="w-full border border-gray-800 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <input
              className="w-full border border-gray-800 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            className="bg-indigo-500 hover:bg-indigo-400 transition-colors text-white rounded-lg py-2.5 font-medium mt-2"
            type="submit"
          >
            Log in
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-gray-400">{label}</span>
      {children}
    </label>
  );
}

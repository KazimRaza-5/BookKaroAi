"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/apiClient";
import RequireAuth from "@/components/RequireAuth";

type Message = { role: "user" | "assistant"; content: string };
type PendingBooking = { serviceId: string; providerId: string; startTime: string };
type SessionSummary = { id: string; createdAt: string; preview: string };

const SESSION_KEY = "chat_session_id";
const SESSION_DATE_KEY = "chat_session_date";
const NUDGE_THRESHOLD = 6;
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 120000;

function todayKey() {
  return new Date().toDateString();
}

function ChatFlow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingBooking | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [showFormNudge, setShowFormNudge] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const userMessageCountRef = useRef(0);
  const everProposedRef = useRef(false);
  const nudgeDismissedRef = useRef(false);

  useEffect(() => {
    apiFetch("/api/services").then(setServices).catch(() => {});
    const savedId = localStorage.getItem(SESSION_KEY);
    const savedDate = localStorage.getItem(SESSION_DATE_KEY);
    if (savedId && savedDate === todayKey()) {
      setSessionId(savedId);
      apiFetch(`/api/chat/${savedId}`)
        .then((data: { messages: any[]; pendingBooking: PendingBooking | null }) => {
          setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
          setPending(data.pendingBooking);
          if (data.pendingBooking) everProposedRef.current = true;
        })
        .catch(() => {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(SESSION_DATE_KEY);
        });
    } else {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_DATE_KEY);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, showFormNudge]);

  function startNewChat() {
    setSessionId(null);
    setMessages([]);
    setPending(null);
    setShowFormNudge(false);
    userMessageCountRef.current = 0;
    everProposedRef.current = false;
    nudgeDismissedRef.current = false;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_DATE_KEY);
    setShowHistory(false);
  }

  async function openHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next) {
      try {
        setHistory(await apiFetch("/api/chat/sessions"));
      } catch {
        setHistory([]);
      }
    }
  }

  async function loadSession(id: string) {
    try {
      const data: { messages: any[]; pendingBooking: PendingBooking | null } = await apiFetch(`/api/chat/${id}`);
      setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
      setPending(data.pendingBooking);
      setSessionId(id);
      setShowFormNudge(false);
      userMessageCountRef.current = 0;
      everProposedRef.current = !!data.pendingBooking;
      nudgeDismissedRef.current = false;
      localStorage.setItem(SESSION_KEY, id);
      localStorage.setItem(SESSION_DATE_KEY, todayKey());
      setShowHistory(false);
    } catch (e: any) {
      setMessages([{ role: "assistant", content: `Couldn't load that conversation: ${e.message}` }]);
      setShowHistory(false);
    }
  }

  async function pollForReply(sid: string, priorCount: number) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const data: { messages: any[]; pendingBooking: PendingBooking | null } = await apiFetch(`/api/chat/${sid}`);
        const lastMsg = data.messages[data.messages.length - 1];
        if (data.messages.length > priorCount && lastMsg?.role === "assistant") {
          setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
          setPending(data.pendingBooking);
          if (data.pendingBooking) everProposedRef.current = true;
          setSending(false);
          sendingRef.current = false;
          return;
        }
      } catch {
        // keep trying
      }
    }
    setMessages((m) => [...m, { role: "assistant", content: "This is taking longer than expected. Please try again." }]);
    setSending(false);
    sendingRef.current = false;
  }

  async function sendMessage() {
    if (!input.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const text = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    userMessageCountRef.current += 1;
    if (userMessageCountRef.current >= NUDGE_THRESHOLD && !everProposedRef.current && !nudgeDismissedRef.current) {
      setShowFormNudge(true);
    }
    try {
      const priorCount = messages.length + 1;
      const result = await apiFetch("/api/chat/message", { method: "POST", body: JSON.stringify({ sessionId, message: text }) });
      if (result.sessionId && result.sessionId !== sessionId) {
        setSessionId(result.sessionId);
        localStorage.setItem(SESSION_KEY, result.sessionId);
        localStorage.setItem(SESSION_DATE_KEY, todayKey());
      }
      await pollForReply(result.sessionId, priorCount);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I ran into a problem sending that. Could you try again?" }]);
      setSending(false);
      sendingRef.current = false;
    }
  }

  async function clearPendingOnServer() {
    if (!sessionId) return;
    try {
      await apiFetch(`/api/chat/${sessionId}/clear-pending`, { method: "POST" });
    } catch {}
  }

  async function confirmPendingBooking() {
    if (!pending) return;
    try {
      await apiFetch("/api/appointments", { method: "POST", body: JSON.stringify(pending) });
      setMessages((m) => [...m, { role: "assistant", content: "✅ Booked! You'll find it on your dashboard." }]);
      setPending(null);
      await clearPendingOnServer();
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Couldn't complete that booking: ${e.message}` }]);
      setPending(null);
      await clearPendingOnServer();
    }
  }

  async function dismissPending() {
    setPending(null);
    await clearPendingOnServer();
  }

  const service = services.find((s) => s.id === pending?.serviceId);

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-6 relative">
        <h1 className="text-2xl font-semibold text-white">Book with AI Assistant</h1>
        <div className="flex gap-2">
          <button onClick={openHistory} className="text-sm glass rounded-full px-4 py-1.5 text-gray-300 hover:bg-white/10 transition">
            History
          </button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={startNewChat} className="btn-gradient text-sm text-white rounded-full px-4 py-1.5 font-medium">
            New chat
          </motion.button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="absolute right-0 top-10 w-72 max-h-80 overflow-y-auto bg-[#15131d]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-10"
              >
                {history.length === 0 && <p className="text-gray-500 text-sm p-4">No previous chats yet.</p>}
                {history.map((s) => (
                  <button key={s.id} onClick={() => loadSession(s.id)} className="block w-full text-left px-4 py-3 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition">
                    <div className="text-sm text-gray-200 truncate">{s.preview}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(s.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short", hour12: true })}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm">Try: "What services do you offer?" or "Book me a general consultation tomorrow morning."</p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user" ? "bg-gradient-to-br from-violet-500 to-pink-500 text-white self-end shadow-lg shadow-violet-500/20" : "glass text-gray-100 self-start"
              }`}
            >
              {m.content}
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {pending && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="self-start max-w-[80%] rounded-2xl p-4 glass border border-pink-400/30 shadow-lg shadow-pink-500/10"
            >
              <p className="text-sm text-gray-200 mb-3">
                {service ? `${service.name} with ${service.provider.name}` : "Appointment"} on{" "}
                {new Date(pending.startTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short", hour12: true })}
              </p>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={confirmPendingBooking} className="btn-gradient text-white text-sm rounded-full px-4 py-2 font-medium">
                  Confirm Booking
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={dismissPending} className="border border-white/15 text-gray-300 text-sm rounded-full px-4 py-2 transition hover:bg-white/5">
                  Not now
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFormNudge && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="self-start max-w-[80%] glass rounded-2xl p-4 flex items-start justify-between gap-3 border border-cyan-400/20"
            >
              <p className="text-sm text-gray-300">
                Still looking for a time? You can also{" "}
                <Link href="/book" className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400 underline font-medium">
                  book directly on the booking page
                </Link>.
              </p>
              <button onClick={() => { setShowFormNudge(false); nudgeDismissedRef.current = true; }} className="text-gray-500 hover:text-gray-300 text-sm" aria-label="Dismiss">
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {sending && (
          <div className="flex gap-1 self-start px-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-2 h-2 rounded-full bg-gradient-to-br from-violet-400 to-pink-400"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 mt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
          placeholder="Type a message…"
          className="flex-1 glass rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400/50 transition-shadow"
        />
        <motion.button whileHover={{ scale: sending ? 1 : 1.05 }} whileTap={{ scale: sending ? 1 : 0.92 }} onClick={sendMessage} disabled={sending} className="btn-gradient text-white rounded-full px-5 py-2.5 font-medium disabled:opacity-40">
          Send
        </motion.button>
      </div>
    </main>
  );
}

export default function ChatPage() {
  return (
    <RequireAuth>
      <ChatFlow />
    </RequireAuth>
  );
}

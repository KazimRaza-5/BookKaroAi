import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { tools } from "../tools/bookingTools";
import { getAvailableSlots, listServices, getMyExistingBookings } from "./booking.service";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", hour12: true });
}

function buildSystemPrompt(): string {
  const now = new Date();
  const nowHuman = now.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `You are a friendly, proactive appointment-booking assistant for a small clinic.

The current date and time is: ${nowHuman} (ISO: ${now.toISOString()}).
Always use this as "now" for relative dates — never assume a different date or year.

Guide the conversation actively:
1. If the user hasn't said which service they want, call list_services and present the options with provider names.
2. If the user hasn't given a date, ask what date or range works for them.
3. Call get_available_slots for the service and date. Each slot has an "index" and a human "time" label — always read times from the "time" label, never compute one yourself.
4. get_available_slots also returns "weekday" — use that exact value if you mention a weekday; never calculate one yourself.
5. get_available_slots also returns "alreadyBookedByYou" — ALL of the user's confirmed appointments that day, with ANY provider (not just this one). If the requested or proposed time overlaps one of these, tell the user plainly which appointment they already have at that time and suggest a different time or date — never propose a slot that would double-book them, even with a different provider than the one they're currently asking about.
6. If no slots are available, check the next 2-3 days yourself and suggest the nearest day with openings.

CRITICAL — never claim success that didn't happen:
7. NEVER say a booking "is confirmed" unless reporting the literal "confirmedTime" from a successful book_appointment result in THIS turn. If it errored, or you haven't called it, say so plainly.
8. After a successful book_appointment call, describe the "confirmedTime" and say "tap Confirm Booking below to finalize it" — never say it's already done.

CRITICAL — slot selection:
9. Call book_appointment with the slot's exact "index" and the same "date" from the get_available_slots call it came from. Never pass a raw time string.
10. If the user's requested time doesn't match any "time" label you were given, say so and list the real options.

Active fallback:
11. If the conversation has gone back and forth several times without converging on a specific bookable slot, or the user seems confused, stuck, or frustrated, proactively mention they can also complete the booking directly on the booking form.

General:
12. Keep replies short — 2-4 sentences. Never invent services, providers, or availability a tool didn't actually return.`;
}

type PendingBooking = { serviceId: string; providerId: string; startTime: string };

const MAX_HISTORY_MESSAGES = 20;

export async function handleChatMessage(sessionId: string, userId: string, userMessage: string): Promise<void> {
  await saveMessage(sessionId, "user", userMessage);

  await prisma.chatSession.update({ where: { id: sessionId }, data: { pendingBooking: Prisma.DbNull } });

  const fullHistory = await getSessionMessages(sessionId);
  const history = fullHistory.slice(-MAX_HISTORY_MESSAGES);
  const messages: any[] = [{ role: "system", content: buildSystemPrompt() }, ...history];

  let response = await callAI(messages);
  let pendingBooking: PendingBooking | undefined;

  const slotCache: Record<string, string[]> = {};

  let iterations = 0;
  const MAX_ITERATIONS = 6;

  while (true) {
    iterations++;
    const msg = response.choices[0].message;
    const toolCalls = msg.tool_calls;

    if (!toolCalls || toolCalls.length === 0 || iterations > MAX_ITERATIONS) {
      const reply = msg.content || "Sorry, I'm having trouble with that request — could you try rephrasing?";
      await saveMessage(sessionId, "assistant", reply);
      if (pendingBooking) {
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: { pendingBooking: pendingBooking as any },
        });
      }
      return;
    }

    messages.push(msg);

    for (const toolCall of toolCalls) {
      let result: any;
      try {
        const args = JSON.parse(toolCall.function.arguments || "{}");

        if (toolCall.function.name === "list_services") {
          result = await listServices();
        } else if (toolCall.function.name === "get_available_slots") {
          const isoSlots = await getAvailableSlots(args.serviceId, args.date);
          slotCache[`${args.serviceId}|${args.date}`] = isoSlots;
          const weekday = new Date(`${args.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
          const myBookings = await getMyExistingBookings(userId, args.date);
          result = {
            date: args.date,
            weekday,
            slots: isoSlots.map((iso, index) => ({ index, time: formatTime(iso) })),
            alreadyBookedByYou: myBookings.map((b) => ({
              time: formatTime(b.time),
              service: b.service,
              provider: b.provider,
            })),
          };
        } else if (toolCall.function.name === "book_appointment") {
          const key = `${args.serviceId}|${args.date}`;
          const daySlots = slotCache[key];
          const resolvedStartTime = daySlots?.[args.slotIndex];

          if (!resolvedStartTime) {
            result = {
              error: `No cached slot for serviceId "${args.serviceId}", date "${args.date}", index ${args.slotIndex}. Call get_available_slots again for that exact service and date first.`,
            };
          } else {
            pendingBooking = { serviceId: args.serviceId, providerId: args.providerId, startTime: resolvedStartTime };
            result = { status: "awaiting_user_confirmation_in_ui", confirmedTime: formatFull(resolvedStartTime) };
          }
        } else {
          result = { error: "Unknown tool" };
        }
      } catch (err: any) {
        result = { error: `That call failed: ${err.message}.` };
      }

      messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }

    response = await callAI(messages);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastCallAt = 0;
const MIN_GAP_MS = 1200;

async function callAI(messages: any[], attempt = 1): Promise<any> {
  const waitNeeded = lastCallAt + MIN_GAP_MS - Date.now();
  if (waitNeeded > 0) await sleep(waitNeeded);
  lastCallAt = Date.now();

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages,
      tools,
      tool_choice: "auto",
    }),
  });

  if (res.status === 429 && attempt <= 3) {
    const retryAfter = res.headers.get("retry-after");
    const waitSeconds = retryAfter ? parseFloat(retryAfter) : 5 * attempt;
    console.warn(`Groq 429 — retrying in ${waitSeconds}s (attempt ${attempt}/3)`);
    await sleep(waitSeconds * 1000);
    return callAI(messages, attempt + 1);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function saveMessage(sessionId: string, role: string, content: string) {
  await prisma.chatMessage.create({ data: { sessionId, role, content } });
}

async function getSessionMessages(sessionId: string) {
  const messages = await prisma.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export async function createSession(userId: string) {
  const session = await prisma.chatSession.create({ data: { userId } });
  return session.id;
}

export async function getFullHistory(sessionId: string) {
  return prisma.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
}

export async function listUserSessions(userId: string) {
  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  return sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    preview: s.messages[0]?.content?.slice(0, 60) || "New conversation",
  }));
}

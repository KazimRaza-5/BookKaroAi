# AI-Assisted Appointment Booking App

A full-stack appointment booking application with a conversational AI assistant, built as a technical skills assessment. Users can book appointments either through a traditional form-based flow or by chatting naturally with an AI assistant that checks real availability and proposes bookings — which the user always confirms explicitly before anything is written to the database.

**Live demo:** _[add link after deployment]_
**GitHub repo:** _[add link once pushed]_
**Video walkthrough:** _[optional]_

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL, via Prisma ORM |
| AI | Groq API (`openai/gpt-oss-120b`), OpenAI-compatible function/tool calling |
| Auth | JWT (bcrypt-hashed passwords) |

---

## Architecture

```
┌──────────────────┐   HTTP (send) + polling (receive)   ┌──────────────────────┐
│   Next.js App      │ ◄───────────────────────────────► │   Express API           │
│  - Booking UI (/book)│                                   │  - Auth (JWT)             │
│  - AI chat UI (/chat) │                                  │  - Validation (zod)        │
│  - Dashboard (/dashboard)│                                │  - Logging (morgan)          │
│  - Notifications        │                                │  - Rate limiting (2 tiers)     │
└──────────────────┘                                    │  - AI orchestration              │
                                                         └──────────┬────────────────┘
                                                                    │
                                              ┌──────────────────────┼──────────────────────┐
                                              ▼                                             ▼
                                    ┌──────────────────┐                         ┌──────────────────┐
                                    │   PostgreSQL        │                         │   Groq API           │
                                    │  (via Prisma)          │                       │  (tool calling)         │
                                    └──────────────────┘                         └──────────────────┘
```

**Key architectural principle:** the AI layer never writes to the database. It can only call three read-safe/propose-only tools (`list_services`, `get_available_slots`, `book_appointment`), and even `book_appointment` doesn't create a row — it hands a proposed booking back to the frontend, which shows an explicit confirm card. The write only happens when the user clicks **Confirm Booking**, through the exact same `POST /api/appointments` endpoint and conflict-checking logic the manual booking form uses. The AI and the manual flow are two front doors to one trusted backend path, never two separate paths with separate guarantees.

**Chat delivery is fire-and-forget + polling.** `POST /api/chat/message` returns almost instantly (`202 Accepted`); the AI work happens in the background, and the frontend polls `GET /api/chat/:sessionId` every 1.5s until a new reply appears — genuine polling, visible as repeated network requests, not a renamed synchronous call.

---

## Features

- Email/password auth with JWT sessions
- Multiple providers and services (a general physician, a dentist offering two services, and a dermatologist), each with independent weekly availability
- **Manual booking flow**: service → date (calendar picker) → real-time available slots → confirm
- **AI chat booking flow**: natural conversation → AI checks real availability via tool calls → proposes a slot → user explicitly confirms
- Conversation history persisted per session; "New chat," "History" (resume past conversations), automatic daily fresh-start
- **Active fallback nudge**: if a chat conversation goes 6+ messages without converging on a bookable slot, the UI deterministically suggests the booking form — guaranteed by a counter in code, not dependent on the model remembering
- Dashboard: appointments table (confirmed-first, most-recent-first), with **Cancel**, **Mark Completed**, and permanent **Delete** actions depending on status
- **Missed-appointment detection**: a confirmed appointment whose time passed without being marked Completed automatically flips to "Missed" (lazy sweep on read, no scheduler needed) and surfaces on a **Notifications** page with a real read/unread badge
- **Double-booking prevention at two levels**: same-provider conflicts, and a separate check preventing overlap across a user's entire schedule regardless of provider (a person can't attend two different providers at once)
- Backend middleware: JWT auth, zod-based request validation, request logging (morgan), two-tier rate limiting (general API + a stricter limit on the AI chat endpoint specifically)
- Glassmorphism visual design with an animated gradient-blob background and Framer Motion micro-interactions throughout — a sliding active-tab indicator in the navbar, spring-based dialog and message entrances, staggered list reveals

---

## AI Integration — Design Notes

The AI assistant uses Groq's function/tool-calling API (OpenAI-compatible format) with three tools:

| Tool | Purpose |
|---|---|
| `list_services` | Read-only. Lists bookable services and providers. |
| `get_available_slots` | Read-only. Returns real open slots for a service+date, each labeled with an index, plus the correct weekday name and any of the user's own existing bookings that day (any provider). |
| `book_appointment` | Takes a slot **index** (not a raw timestamp) + the date it came from. Resolved server-side against a same-turn cache of the actual slots just returned — the model is never trusted to reproduce an exact timestamp. |

**Why index-based slot selection instead of raw timestamps.** Earlier in development, the model would occasionally state one time in conversation but pass a different (though still real) time to the booking tool. Switching to integer slot indices, resolved server-side against a cache built in the same turn, means the text the model says and the time that actually gets proposed are generated from the exact same lookup — they cannot disagree, by construction.

**Multi-turn memory:** conversations persist in Postgres (`chat_sessions` / `chat_messages`). Each new message resends the last 20 messages of history (capped to control token usage) plus a system prompt including the real current date/time — LLMs have no innate sense of "today," so this is computed fresh per-request.

**Guardrails beyond the confirm-click pattern:**
- The model is told never to claim a booking "is confirmed" unless reporting a literal success result from the current turn.
- `get_available_slots` returns all of the user's existing bookings that day across every provider, so the assistant can proactively flag a cross-provider conflict instead of proposing one.
- A hard iteration cap prevents a confused model from looping through tool calls indefinitely.
- A pragmatic provider switch: originally built against Mistral (per the assessment's suggestion), but its free tier's actual usable throughput proved too restrictive for iterative development. Switched to Groq, which uses the same tool-calling shape, so the switch required no changes to the orchestration logic itself.

---

## API Reference

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/services` | — | List bookable services |
| GET | `/api/appointments/availability?serviceId=&date=` | — | Real open slots for a day |
| POST | `/api/appointments` | ✅ | Create appointment (conflict-checked, cross-provider aware) |
| GET | `/api/appointments/me` | ✅ | List current user's appointments |
| DELETE | `/api/appointments/:id` | ✅ | Cancel appointment (soft) |
| POST | `/api/appointments/:id/complete` | ✅ | Mark a confirmed appointment as completed |
| DELETE | `/api/appointments/:id/permanent` | ✅ | Hard-delete a non-active appointment record |
| GET | `/api/appointments/notifications` | ✅ | List missed (no-show) appointments |
| GET | `/api/appointments/notifications/unseen-count` | ✅ | Unread missed-appointment count, for the navbar badge |
| POST | `/api/appointments/notifications/mark-seen` | ✅ | Marks all currently-missed appointments as seen |
| POST | `/api/chat/message` | ✅ | Send a message to the AI assistant (returns `202`, work happens async) |
| GET | `/api/chat/:sessionId` | ✅ | Polled for new messages + any pending booking proposal |
| GET | `/api/chat/sessions` | ✅ | List current user's past chat sessions |
| POST | `/api/chat/:sessionId/clear-pending` | ✅ | Clears a proposed booking once confirmed or dismissed |

---

## Database Schema

Full details in [`backend/sql/schema.sql`](./backend/sql/schema.sql) (raw DDL) and [`backend/sql/sample_inserts.sql`](./backend/sql/sample_inserts.sql). Managed day-to-day via Prisma migrations.

**Tables:** `users`, `providers`, `services`, `availability`, `appointments`, `chat_sessions`, `chat_messages`.

**Indexing strategy:**
- `appointments(provider_id, start_time)` — the most load-bearing index. Both the availability lookup and the double-booking conflict check filter on exactly this combination.
- `appointments(user_id, status, start_time DESC)` — supports the dashboard's "confirmed first, most recent first" ordering directly at the index level.
- `appointment_status` enum is deliberately declared `CONFIRMED, CANCELLED, COMPLETED, NO_SHOW` — Postgres native enums sort by declaration order, so "confirmed sorts first" falls out of that ordering for free.

**Performance considerations:** conversation history sent to the AI per request is capped at 20 messages regardless of how long a chat session runs, keeping both token cost and response latency bounded rather than growing unboundedly over a long conversation. Dashboard pagination is currently client-side, called out explicitly below as a scale limitation.

---

## Setup — Running Locally

### Prerequisites
- Node.js 18+
- Docker (for Postgres) or a local Postgres install
- A free Groq API key from [console.groq.com](https://console.groq.com) (no card required)

### 1. Database
```bash
cd backend
docker compose up -d
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env   # then fill in DATABASE_URL, JWT_SECRET, GROQ_API_KEY
npx prisma migrate dev
npx prisma db seed
npm run dev             # runs on http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
npm run dev             # runs on http://localhost:3000
```

### 4. Try it
- Register an account at `/register`
- Book manually at `/book`, or converse with the assistant at `/chat`
- View/manage bookings at `/dashboard`; check `/notifications` for anything missed

---

## Key Design Decisions & Tradeoffs

**Polling, not WebSockets.** The chat interaction is turn-based rather than needing a continuously open connection — simpler to reason about and debug for this scope. `POST /api/chat/message` returns immediately; the frontend polls for the result.

**Chat failures degrade gracefully rather than crashing.** If the AI call fails, a friendly assistant-style message gets written to the conversation instead of a raw error; the real error is still logged server-side.

**Two separate rate limiters.** A general limiter protects the whole API; a stricter one applies specifically to the AI chat endpoint, since each call there costs real external API quota — a different concern from general abuse protection.

**`createAppointment` derives `providerId` from the service record, never trusts the caller** — a service belongs to exactly one provider by schema design, so there's no legitimate case where a caller-supplied value should differ.

**Missed-appointment detection is a lazy, read-triggered sweep, not a background job.** Every time appointments are fetched, one query flips any past-due `CONFIRMED` appointment to `NO_SHOW`. Simple and accurate for this scope; a scheduler would be real overengineering here.

**Index-based AI slot selection instead of raw timestamps** — a direct response to a real reliability bug found during development (see AI Integration above), not a speculative design choice.

**Provider switch from Mistral to Groq.** Both are equally valid per the assessment's own wording ("any AI provider... Mistral is recommended"). The switch was a pragmatic response to Mistral's free tier proving too restrictive for iterative testing.

---

## Known Limitations

- **AI provider rate limits.** Even on Groq's free tier, the model in use occasionally hits a `429` under rapid back-to-back testing. Retry-with-backoff and a client-side throttle reduce this; a persistent external quota constraint isn't something client-side code can fully eliminate.
- **No AI-driven cancellation yet.** The chat assistant can propose and book but not cancel — cancellation currently only exists on the Dashboard. Extending the same propose-then-confirm pattern to a `cancel_appointment` tool is the natural next step.
- **No multi-tenancy.** All providers/services belong to a single implicit "business." Adding a `business_id` scoping column would be the natural next step for a real multi-tenant SaaS version.
- **Client-side pagination on the dashboard.** Fine at this data scale; would move server-side for a much larger appointment history.
- **CORS currently allows all origins**, for local development convenience — restricted to the deployed frontend's exact origin once deployed.

---

## Possible Future Improvements

- A `cancel_appointment` AI tool, following the same propose-then-confirm pattern as booking
- Server-side pagination for appointments
- Multi-tenancy support (`business_id` scoping)
- Email/SMS confirmation and missed-appointment notifications

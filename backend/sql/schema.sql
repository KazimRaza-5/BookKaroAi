-- Appointment Booking App — PostgreSQL Schema (DDL)
-- This mirrors prisma/schema.prisma exactly. Prisma migrations are the source of
-- truth applied to the database; this file is a plain-SQL reference for review.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- provides gen_random_uuid()

-- ─── Enums ──────────────────────────────────────────────────────────────────
-- Note: CONFIRMED is declared FIRST deliberately. Postgres native enums sort by
-- declaration order (not alphabetically), and the app relies on this so that
-- "ORDER BY status" naturally puts confirmed appointments first with no extra
-- CASE/ranking logic needed.
CREATE TYPE appointment_status AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'PROVIDER', 'ADMIN');

-- ─── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    role           user_role NOT NULL DEFAULT 'CUSTOMER',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Providers ──────────────────────────────────────────────────────────────
CREATE TABLE providers (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name  TEXT NOT NULL,
    bio   TEXT
);

-- ─── Services ───────────────────────────────────────────────────────────────
CREATE TABLE services (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    duration_min  INTEGER NOT NULL,
    price         NUMERIC(10, 2) NOT NULL,
    provider_id   UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE
);

CREATE INDEX idx_services_provider_id ON services(provider_id);

-- ─── Availability ───────────────────────────────────────────────────────────
-- weekday: 0 = Sunday ... 6 = Saturday (matches JavaScript's Date.getDay())
CREATE TABLE availability (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    weekday      INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time   TEXT NOT NULL, -- "09:00" format
    end_time     TEXT NOT NULL  -- "17:00" format
);

CREATE INDEX idx_availability_provider_weekday ON availability(provider_id, weekday);

-- ─── Appointments ───────────────────────────────────────────────────────────
CREATE TABLE appointments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    service_id   UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    start_time   TIMESTAMPTZ NOT NULL,
    end_time     TIMESTAMPTZ NOT NULL,
    status       appointment_status NOT NULL DEFAULT 'CONFIRMED',
    missed_seen  BOOLEAN NOT NULL DEFAULT false, -- has the user acknowledged this on the Notifications page?
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The most important index in the schema: every availability check and conflict
-- check filters by provider + a time range. Without this, both queries degrade
-- to a full table scan as appointment volume grows.
CREATE INDEX idx_appointments_provider_start ON appointments(provider_id, start_time);

-- Supports "GET /api/appointments/me", sorted with confirmed-first (via the enum
-- ordering above) and most recent first within each status group.
CREATE INDEX idx_appointments_user_status_start ON appointments(user_id, status, start_time DESC);

-- ─── Chat Sessions ──────────────────────────────────────────────────────────
CREATE TABLE chat_sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    pending_booking JSONB, -- an AI-proposed booking awaiting the user's explicit confirm click
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id, created_at DESC);

-- ─── Chat Messages ──────────────────────────────────────────────────────────
CREATE TABLE chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL, -- 'user' | 'assistant'
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id, created_at ASC);

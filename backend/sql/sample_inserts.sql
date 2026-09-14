-- Sample data — mirrors backend/prisma/seed.ts, provided here as plain SQL
-- for reviewers who want to inspect or run the schema without Prisma tooling.

-- One provider
INSERT INTO providers (id, name, bio) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Dr. Aisha Khan', 'General physician');

-- One service offered by that provider
INSERT INTO services (id, name, duration_min, price, provider_id) VALUES
    ('22222222-2222-2222-2222-222222222222', 'General Consultation', 30, 20.00,
     '11111111-1111-1111-1111-111111111111');

-- Availability: Monday, Tuesday, Wednesday, 9:00 AM – 5:00 PM
INSERT INTO availability (provider_id, weekday, start_time, end_time) VALUES
    ('11111111-1111-1111-1111-111111111111', 1, '09:00', '17:00'), -- Monday
    ('11111111-1111-1111-1111-111111111111', 2, '09:00', '17:00'), -- Tuesday
    ('11111111-1111-1111-1111-111111111111', 3, '09:00', '17:00'); -- Wednesday

-- One sample user (password_hash is a bcrypt hash of "password123", cost factor 10 —
-- generate your own with `node -e "console.log(require('bcrypt').hashSync('password123', 10))"`
-- if you want a real working login; this is illustrative)
INSERT INTO users (id, name, email, password_hash, role) VALUES
    ('33333333-3333-3333-3333-333333333333', 'Test User', 'test@example.com',
     '$2b$10$examplehashvaluereplacewithrealbcrypthash', 'CUSTOMER');

-- One sample confirmed appointment
INSERT INTO appointments (user_id, provider_id, service_id, start_time, end_time, status) VALUES
    ('33333333-3333-3333-3333-333333333333',
     '11111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222',
     '2026-09-07 09:00:00+00',
     '2026-09-07 09:30:00+00',
     'CONFIRMED');

-- One sample chat session with a couple of messages
INSERT INTO chat_sessions (id, user_id) VALUES
    ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333');

INSERT INTO chat_messages (session_id, role, content) VALUES
    ('44444444-4444-4444-4444-444444444444', 'user', 'What services do you offer?'),
    ('44444444-4444-4444-4444-444444444444', 'assistant',
     'We offer a General Consultation with Dr. Aisha Khan — 30 minutes, $20.');

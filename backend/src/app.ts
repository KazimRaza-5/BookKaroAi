import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.routes";
import servicesRoutes from "./routes/services.routes";
import appointmentsRoutes from "./routes/appointments.routes";
import chatRoutes from "./routes/chat.routes";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());
app.use(morgan("dev")); // logs: METHOD /path STATUS response-time-ms

// General limiter: protects the whole API from casual abuse/misuse.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(generalLimiter);

// Stricter limiter just for the AI chat endpoint — each call costs real Mistral
// quota, so this endpoint deserves tighter protection than a cheap read like
// GET /api/services.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 chat messages per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You're sending messages too quickly. Please slow down." },
});
app.use("/api/chat/message", chatLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/chat", chatRoutes);

export default app;

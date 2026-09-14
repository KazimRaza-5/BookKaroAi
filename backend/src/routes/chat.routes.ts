import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import { chatMessageSchema } from "../validation/schemas";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import {
  handleChatMessage,
  createSession,
  getFullHistory,
  listUserSessions,
  saveMessage,
} from "../services/ai.service";

const router = Router();

router.post("/message", requireAuth, validate(chatMessageSchema), async (req: AuthRequest, res) => {
  try {
    let { sessionId, message } = req.body;

    if (!sessionId) {
      sessionId = await createSession(req.userId!);
    } else {
      const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
      if (!session || session.userId !== req.userId) {
        return res.status(403).json({ error: "Invalid session" });
      }
    }

    // Fire-and-forget — the frontend polls GET /:sessionId for the result.
    handleChatMessage(sessionId, req.userId!, message).catch(async (e) => {
      console.error("Chat error (background):", e);
      await saveMessage(sessionId, "assistant", "Sorry, something went wrong on my end. Could you try again?");
    });

    res.status(202).json({ sessionId, status: "processing" });
  } catch (e: any) {
    // Catches failures in session setup itself (before the background job even starts) —
    // this is the part that was left unprotected after the polling refactor.
    console.error("Chat error (session setup):", e);
    res.status(500).json({ error: "Something went wrong starting the chat. Please try again." });
  }
});

router.get("/sessions", requireAuth, async (req: AuthRequest, res) => {
  const sessions = await listUserSessions(req.userId!);
  res.json(sessions);
});

router.get("/:sessionId", requireAuth, async (req: AuthRequest, res) => {
  const session = await prisma.chatSession.findUnique({ where: { id: req.params.sessionId } });
  if (!session || session.userId !== req.userId) {
    return res.status(403).json({ error: "Invalid session" });
  }
  const messages = await getFullHistory(req.params.sessionId);
  res.json({ messages, pendingBooking: session.pendingBooking || null });
});

router.post("/:sessionId/clear-pending", requireAuth, async (req: AuthRequest, res) => {
  const session = await prisma.chatSession.findUnique({ where: { id: req.params.sessionId } });
  if (!session || session.userId !== req.userId) {
    return res.status(403).json({ error: "Invalid session" });
  }
  await prisma.chatSession.update({ where: { id: req.params.sessionId }, data: { pendingBooking: Prisma.DbNull } });
  res.status(204).send();
});

export default router;

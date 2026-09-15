import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import { createAppointmentSchema } from "../validation/schemas";
import {
  getAvailableSlots,
  createAppointment,
  listMyAppointments,
  getMissedAppointments,
  getUnseenMissedCount,
  markMissedAsSeen,
  cancelAppointment,
  completeAppointment,
  deleteAppointmentPermanently,
} from "../services/booking.service";

const router = Router();

router.get("/availability", async (req, res) => {
  const { serviceId, date } = req.query as { serviceId: string; date: string };
  if (!serviceId || !date) return res.status(400).json({ error: "serviceId and date are required" });
  const slots = await getAvailableSlots(serviceId, date);
  res.json(slots);
});

router.post("/", requireAuth, validate(createAppointmentSchema), async (req: AuthRequest, res) => {
  try {
    const { providerId, serviceId, startTime } = req.body;
    const appt = await createAppointment({
      userId: req.userId!,
      providerId,
      serviceId,
      startTime: new Date(startTime),
    });
    res.status(201).json(appt);
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const appts = await listMyAppointments(req.userId!);
  res.json(appts);
});

// Missed = CONFIRMED appointments whose time passed without being marked Completed.
// Registered as a distinct path — never collides with "/:id" style routes below.
router.get("/notifications", requireAuth, async (req: AuthRequest, res) => {
  const missed = await getMissedAppointments(req.userId!);
  res.json(missed);
});

router.get("/notifications/unseen-count", requireAuth, async (req: AuthRequest, res) => {
  const count = await getUnseenMissedCount(req.userId!);
  res.json({ count });
});

router.post("/notifications/mark-seen", requireAuth, async (req: AuthRequest, res) => {
  await markMissedAsSeen(req.userId!);
  res.status(204).send();
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    await cancelAppointment(req.userId!, req.params.id as string);
    res.status(204).send();
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post("/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const appt = await completeAppointment(req.userId!, req.params.id as string);
    res.json(appt);
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete("/:id/permanent", requireAuth, async (req: AuthRequest, res) => {
  try {
    await deleteAppointmentPermanently(req.userId!, req.params.id as string);
    res.status(204).send();
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;

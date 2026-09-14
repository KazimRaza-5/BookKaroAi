import { prisma } from "../db/client";

export async function listServices() {
  return prisma.service.findMany({ include: { provider: true } });
}

export async function getAvailableSlots(serviceId: string, dateStr: string) {
  const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
  const date = new Date(`${dateStr}T00:00:00`);
  const weekday = date.getDay();

  const availability = await prisma.availability.findFirst({
    where: { providerId: service.providerId, weekday },
  });
  if (!availability) return [];

  const [startH, startM] = availability.startTime.split(":").map(Number);
  const [endH, endM] = availability.endTime.split(":").map(Number);

  let cursor = new Date(date);
  cursor.setHours(startH, startM, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(endH, endM, 0, 0);

  const existing = await prisma.appointment.findMany({
    where: { providerId: service.providerId, status: "CONFIRMED", startTime: { gte: cursor, lt: dayEnd } },
  });

  const now = new Date();
  const slots: string[] = [];

  while (cursor.getTime() + service.durationMin * 60000 <= dayEnd.getTime()) {
    const slotEnd = new Date(cursor.getTime() + service.durationMin * 60000);
    const overlaps = existing.some((a) => cursor < a.endTime && slotEnd > a.startTime);
    const alreadyPassed = cursor <= now;

    if (!overlaps && !alreadyPassed) {
      slots.push(cursor.toISOString());
    }

    cursor = new Date(cursor.getTime() + service.durationMin * 60000);
  }

  return slots;
}

// Now returns ALL of the user's confirmed appointments that day, across every
// provider — not just the one being asked about. This lets the AI proactively
// warn about a cross-provider double-booking before even proposing a conflicting
// slot, not just after the fact.
export async function getMyExistingBookings(userId: string, dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const mine = await prisma.appointment.findMany({
    where: { userId, status: "CONFIRMED", startTime: { gte: dayStart, lte: dayEnd } },
    include: { service: true, provider: true },
  });

  return mine.map((a) => ({
    time: a.startTime.toISOString(),
    service: a.service.name,
    provider: a.provider.name,
  }));
}

export async function createAppointment(input: {
  userId: string;
  providerId: string;
  serviceId: string;
  startTime: Date;
}) {
  const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });
  const providerId = service.providerId;
  const endTime = new Date(input.startTime.getTime() + service.durationMin * 60000);

  // Check 1: does the user already have ANY confirmed appointment — with any
  // provider — that overlaps this time? A person can't be in two places at once,
  // regardless of whether it's the same doctor or a different one.
  const ownConflict = await prisma.appointment.findFirst({
    where: {
      userId: input.userId,
      status: "CONFIRMED",
      startTime: { lt: endTime },
      endTime: { gt: input.startTime },
    },
    include: { service: true, provider: true },
  });
  if (ownConflict) {
    const err: any = new Error(
      `You already have ${ownConflict.service.name} with ${ownConflict.provider.name} booked at that time. Please choose a different time or date.`
    );
    err.status = 409;
    throw err;
  }

  // Check 2: existing check — is this specific provider's slot taken (by anyone)?
  const conflict = await prisma.appointment.findFirst({
    where: {
      providerId,
      status: "CONFIRMED",
      startTime: { lt: endTime },
      endTime: { gt: input.startTime },
    },
  });
  if (conflict) {
    const err: any = new Error("That slot is no longer available.");
    err.status = 409;
    throw err;
  }

  return prisma.appointment.create({
    data: {
      userId: input.userId,
      providerId,
      serviceId: input.serviceId,
      startTime: input.startTime,
      endTime,
    },
  });
}

async function syncMissedAppointments(userId: string) {
  await prisma.appointment.updateMany({
    where: { userId, status: "CONFIRMED", startTime: { lt: new Date() } },
    data: { status: "NO_SHOW" },
  });
}

export async function listMyAppointments(userId: string) {
  await syncMissedAppointments(userId);
  return prisma.appointment.findMany({
    where: { userId },
    include: { service: true, provider: true },
    orderBy: [{ status: "asc" }, { startTime: "desc" }],
  });
}

export async function getMissedAppointments(userId: string) {
  await syncMissedAppointments(userId);
  return prisma.appointment.findMany({
    where: { userId, status: "NO_SHOW" },
    include: { service: true, provider: true },
    orderBy: { startTime: "desc" },
  });
}

// NEW: count only, for the navbar badge — excludes ones already marked seen.
export async function getUnseenMissedCount(userId: string) {
  await syncMissedAppointments(userId);
  return prisma.appointment.count({
    where: { userId, status: "NO_SHOW", missedSeen: false },
  });
}

// NEW: called when the user opens the Notifications page.
export async function markMissedAsSeen(userId: string) {
  await prisma.appointment.updateMany({
    where: { userId, status: "NO_SHOW", missedSeen: false },
    data: { missedSeen: true },
  });
}

export async function cancelAppointment(userId: string, appointmentId: string) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || appt.userId !== userId) {
    const err: any = new Error("Appointment not found");
    err.status = 404;
    throw err;
  }
  return prisma.appointment.update({ where: { id: appointmentId }, data: { status: "CANCELLED" } });
}

export async function completeAppointment(userId: string, appointmentId: string) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || appt.userId !== userId) {
    const err: any = new Error("Appointment not found");
    err.status = 404;
    throw err;
  }
  return prisma.appointment.update({ where: { id: appointmentId }, data: { status: "COMPLETED" } });
}

export async function deleteAppointmentPermanently(userId: string, appointmentId: string) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || appt.userId !== userId) {
    const err: any = new Error("Appointment not found");
    err.status = 404;
    throw err;
  }
  if (appt.status === "CONFIRMED") {
    const err: any = new Error("Cancel this appointment before deleting it permanently.");
    err.status = 400;
    throw err;
  }
  await prisma.appointment.delete({ where: { id: appointmentId } });
}

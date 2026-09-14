import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Clear existing data for a clean re-seed (safe for a dev/demo database)
  await prisma.appointment.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.service.deleteMany();
  await prisma.provider.deleteMany();

  // ─── Dr. Aisha Khan — General Physician ───────────────────────────────
  const aisha = await prisma.provider.create({
    data: { name: "Dr. Aisha Khan", bio: "General physician" },
  });
  const generalConsultation = await prisma.service.create({
    data: { name: "General Consultation", durationMin: 30, price: 20.0, providerId: aisha.id },
  });
  await prisma.availability.createMany({
    data: [
      { providerId: aisha.id, weekday: 1, startTime: "09:00", endTime: "17:00" }, // Mon
      { providerId: aisha.id, weekday: 2, startTime: "09:00", endTime: "17:00" }, // Tue
      { providerId: aisha.id, weekday: 3, startTime: "09:00", endTime: "17:00" }, // Wed
    ],
  });

  // ─── Dr. James Carter — Dentist ────────────────────────────────────────
  const james = await prisma.provider.create({
    data: { name: "Dr. James Carter", bio: "Dentist" },
  });
  const dentalCheckup = await prisma.service.create({
    data: { name: "Dental Checkup", durationMin: 45, price: 35.0, providerId: james.id },
  });
  const teethCleaning = await prisma.service.create({
    data: { name: "Teeth Cleaning", durationMin: 30, price: 25.0, providerId: james.id },
  });
  await prisma.availability.createMany({
    data: [
      { providerId: james.id, weekday: 2, startTime: "10:00", endTime: "18:00" }, // Tue
      { providerId: james.id, weekday: 3, startTime: "10:00", endTime: "18:00" }, // Wed
      { providerId: james.id, weekday: 4, startTime: "10:00", endTime: "18:00" }, // Thu
    ],
  });

  // ─── Dr. Maria Lopez — Dermatologist ───────────────────────────────────
  const maria = await prisma.provider.create({
    data: { name: "Dr. Maria Lopez", bio: "Dermatologist" },
  });
  const skinConsultation = await prisma.service.create({
    data: { name: "Skin Consultation", durationMin: 30, price: 40.0, providerId: maria.id },
  });
  await prisma.availability.createMany({
    data: [
      { providerId: maria.id, weekday: 1, startTime: "08:00", endTime: "15:00" }, // Mon
      { providerId: maria.id, weekday: 3, startTime: "08:00", endTime: "15:00" }, // Wed
      { providerId: maria.id, weekday: 5, startTime: "08:00", endTime: "15:00" }, // Fri
    ],
  });

  console.log("Seeded providers:", { aisha: aisha.id, james: james.id, maria: maria.id });
  console.log("Seeded services:", {
    generalConsultation: generalConsultation.id,
    dentalCheckup: dentalCheckup.id,
    teethCleaning: teethCleaning.id,
    skinConsultation: skinConsultation.id,
  });
}

main().finally(() => prisma.$disconnect());

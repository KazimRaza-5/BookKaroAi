import { Router } from "express";
import { prisma } from "../db/client";

const router = Router();

router.get("/", async (_req, res) => {
  const services = await prisma.service.findMany({ include: { provider: true } });
  res.json(services);
});

export default router;

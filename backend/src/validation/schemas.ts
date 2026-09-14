import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const createAppointmentSchema = z.object({
  providerId: z.string().uuid("Invalid providerId"),
  serviceId: z.string().uuid("Invalid serviceId"),
  startTime: z.string().datetime({ message: "startTime must be a valid ISO datetime" }),
});

export const chatMessageSchema = z.object({
  sessionId: z.string().uuid().nullish(),
  message: z.string().min(1, "message is required").max(2000, "message is too long"),
});

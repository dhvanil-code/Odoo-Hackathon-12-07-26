import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.url().optional(),
  APP_URL: z.url().optional(),
  UPLOAD_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().default("./storage/uploads"),
  CRON_SECRET: z.string().min(16).optional(),
});
export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  APP_URL: process.env.APP_URL,
  UPLOAD_DRIVER: process.env.UPLOAD_DRIVER,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  CRON_SECRET: process.env.CRON_SECRET,
});

import nodemailer from "nodemailer";
export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM)
    return { delivered: false, reason: "SMTP not configured" };
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  return { delivered: true };
}

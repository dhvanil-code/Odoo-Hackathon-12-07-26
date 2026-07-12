import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { sendEmail } from "@/services/email";

const schema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
});
export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    const user = await db.user.findUnique({ where: { email } });
    let developmentToken: string | undefined;
    if (user) {
      const recent = await db.activityLog.count({
        where: {
          entityId: user.id,
          action: "PASSWORD_RESET_REQUESTED",
          createdAt: { gte: new Date(Date.now() - 15 * 60000) },
        },
      });
      if (recent < 3) {
        const token = randomBytes(32).toString("base64url");
        developmentToken =
          process.env.NODE_ENV === "production" ? undefined : token;
        await db.$transaction(async (tx) => {
          await tx.passwordResetToken.create({
            data: {
              userId: user.id,
              tokenHash: createHash("sha256").update(token).digest("hex"),
              expiresAt: new Date(Date.now() + 30 * 60000),
            },
          });
          await tx.activityLog.create({
            data: {
              actorId: user.id,
              action: "PASSWORD_RESET_REQUESTED",
              entityType: "User",
              entityId: user.id,
            },
          });
        });
        const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${encodeURIComponent(token)}`;
        await sendEmail({
          to: user.email,
          subject: "Reset your AssetFlow password",
          text: `Use this link within 30 minutes: ${resetUrl}`,
        });
      }
    }
    return Response.json({
      message: "If the account exists, reset instructions have been created.",
      developmentToken,
    });
  } catch (error) {
    return jsonError(error);
  }
}

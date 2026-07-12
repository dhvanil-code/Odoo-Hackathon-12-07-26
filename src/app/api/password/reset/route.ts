import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { jsonError } from "@/lib/http";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(12).max(128),
});
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    await db.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      if (!token || token.usedAt || token.expiresAt <= new Date())
        throw new DomainError(
          "INVALID_RESET_TOKEN",
          "The reset link is invalid or expired.",
        );
      await tx.user.update({
        where: { id: token.userId },
        data: {
          passwordHash: await hash(input.password, 12),
          failedLogins: 0,
          lockedUntil: null,
        },
      });
      await tx.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      });
      await tx.session.deleteMany({ where: { userId: token.userId } });
      await tx.activityLog.create({
        data: {
          actorId: token.userId,
          action: "PASSWORD_RESET_COMPLETED",
          entityType: "User",
          entityId: token.userId,
        },
      });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

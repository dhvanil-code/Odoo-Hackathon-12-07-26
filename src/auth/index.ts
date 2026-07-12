import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-assetflow.session"
          : "assetflow.session",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = z
          .object({
            email: z.email().transform((v) => v.toLowerCase()),
            password: z.string().min(8).max(128),
          })
          .safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          include: { employee: true, roles: { include: { role: true } } },
        });
        if (
          !user ||
          user.employee?.status !== "ACTIVE" ||
          (user.lockedUntil && user.lockedUntil > new Date()) ||
          !(await compare(parsed.data.password, user.passwordHash))
        ) {
          if (user)
            await db.user.update({
              where: { id: user.id },
              data: {
                failedLogins: { increment: 1 },
                lockedUntil:
                  user.failedLogins >= 4
                    ? new Date(Date.now() + 15 * 60_000)
                    : undefined,
              },
            });
          await db.activityLog.create({
            data: {
              actorId: user?.id,
              action: "LOGIN_FAILURE",
              entityType: "User",
              entityId: user?.id,
              outcome: "DENIED",
              reason: "Invalid credentials or inactive account",
            },
          });
          return null;
        }
        await db.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, lockedUntil: null },
        });
        return {
          id: user.id,
          email: user.email,
          name: user.employee?.name,
          roles: user.roles.map((r) => r.role.name),
          employeeId: user.employee?.id,
          departmentId: user.employee?.departmentId,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.roles = (user as typeof user & { roles: string[] }).roles;
        token.employeeId = (
          user as typeof user & { employeeId: string }
        ).employeeId;
        token.departmentId = (
          user as typeof user & { departmentId?: string }
        ).departmentId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = String(token.id);
        session.user.roles = (token.roles ??
          []) as import("@prisma/client").RoleName[];
        session.user.employeeId = String(token.employeeId);
        session.user.departmentId = token.departmentId
          ? String(token.departmentId)
          : null;
      }
      return session;
    },
  },
});

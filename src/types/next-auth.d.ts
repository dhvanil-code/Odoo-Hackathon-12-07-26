import type { DefaultSession } from "next-auth";
import type { RoleName } from "@prisma/client";
declare module "next-auth" {
  interface User {
    roles?: RoleName[];
    employeeId?: string;
    departmentId?: string | null;
  }
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      roles: RoleName[];
      employeeId: string;
      departmentId: string | null;
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roles?: RoleName[];
    employeeId?: string;
    departmentId?: string | null;
  }
}

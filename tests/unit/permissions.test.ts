import { describe, it, expect } from "vitest";
import { hasPermission } from "@/auth/permissions";
describe("RBAC", () => {
  it("prevents employee asset registration", () =>
    expect(hasPermission(["EMPLOYEE"], "assets:write")).toBe(false));
  it("prevents managers assigning roles", () =>
    expect(hasPermission(["ASSET_MANAGER"], "roles:manage")).toBe(false));
  it("permits auditors to execute assigned work", () =>
    expect(hasPermission(["AUDITOR"], "audits:execute")).toBe(true));
});

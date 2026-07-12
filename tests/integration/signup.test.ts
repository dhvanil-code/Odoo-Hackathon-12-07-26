import { describe, expect, it } from "vitest";
const enabled = process.env.RUN_DB_TESTS === "true";
describe.skipIf(!enabled)("signup security", () => {
  it("rejects self-promotion fields", async () => {
    const { POST } = await import("@/app/api/signup/route");
    const response = await POST(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Malicious Signup",
          email: `malicious-${Date.now()}@assetflow.local`,
          password: "LongEnoughPassword!",
          role: "ADMIN",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("ROLE_FIELD_FORBIDDEN");
  });
  it("creates only the Employee role", async () => {
    const { POST } = await import("@/app/api/signup/route");
    const email = `signup-${Date.now()}@assetflow.local`;
    const response = await POST(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Secure Signup",
          email,
          password: "LongEnoughPassword!",
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect((await response.json()).role).toBe("EMPLOYEE");
  });
});

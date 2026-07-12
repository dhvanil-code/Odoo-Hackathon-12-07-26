import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("AssetFlowDemo!2026");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("admin can navigate protected operational workspaces", async ({
  page,
}) => {
  await login(page, "admin@assetflow.local");
  await expect(
    page.getByRole("heading", { name: "Operational overview" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Assets" }).click();
  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "+ Register asset" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Resource booking" }).click();
  await expect(
    page.getByRole("heading", { name: "Booking calendar" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Maintenance" }).click();
  await expect(
    page.getByRole("heading", { name: "Maintenance board" }),
  ).toBeVisible();
});

test("employee navigation omits admin-only modules", async ({ page }) => {
  await login(page, "employee@assetflow.local");
  await expect(page.getByRole("link", { name: "Organization" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Assets" })).toBeVisible();
});

for (const [role, email, expectedLink] of [
  ["asset manager", "manager@assetflow.local", "Activity logs"],
  ["department head", "head@assetflow.local", "Reports"],
  ["auditor", "auditor@assetflow.local", "Audits"],
] as const) {
  test(`${role} demo account authenticates with scoped navigation`, async ({
    page,
  }) => {
    await login(page, email);
    await expect(page.getByRole("link", { name: expectedLink })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  });
}

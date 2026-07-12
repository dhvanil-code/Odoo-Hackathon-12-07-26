import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 1,
});
await page.goto("http://127.0.0.1:3000/login");
await page.getByLabel("Work email").fill("admin@assetflow.local");
await page.getByLabel("Password").fill("AssetFlowDemo!2026");
await page.getByRole("button", { name: "Sign in securely" }).click();
await page.waitForURL(/dashboard/);
for (const [name, path] of [
  ["dashboard", "/dashboard"],
  ["asset-directory", "/assets"],
  ["allocation-conflict", "/allocations"],
  ["booking-calendar", "/bookings"],
  ["maintenance-board", "/maintenance"],
  ["audit-cycle", "/audits"],
  ["reports", "/reports"],
]) {
  await page.goto(`http://127.0.0.1:3000${path}`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: `docs/screenshots/${name}.png`,
    fullPage: true,
  });
}
const publicPage = await browser.newPage({
  viewport: { width: 1440, height: 980 },
});
await publicPage.goto("http://127.0.0.1:3000/login", {
  waitUntil: "networkidle",
});
await publicPage.screenshot({
  path: "docs/screenshots/login.png",
  fullPage: true,
});
await publicPage.getByLabel("Work email").fill("employee@assetflow.local");
await publicPage.getByLabel("Password").fill("AssetFlowDemo!2026");
await publicPage.getByRole("button", { name: "Sign in securely" }).click();
await publicPage.waitForURL(/dashboard/);
await publicPage.screenshot({
  path: "docs/screenshots/employee-dashboard.png",
  fullPage: true,
});
await browser.close();

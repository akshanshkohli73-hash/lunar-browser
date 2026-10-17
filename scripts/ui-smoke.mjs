import assert from "node:assert/strict";
import fs from "node:fs";
import { preview } from "vite";
import { chromium } from "playwright-core";
const server = await preview({ preview: { host: "0.0.0.0", port: 0 } });
let browser;
try {
  const options = { headless: true };
  if (process.env.CHROMIUM_PATH)
    options.executablePath = process.env.CHROMIUM_PATH;
  // Optional flags apply only to this external test browser, never Electron's configuration.
  if (process.env.UI_TEST_CHROMIUM_ARGS)
    options.args = JSON.parse(process.env.UI_TEST_CHROMIUM_ARGS);
  browser = await chromium.launch(options);
  const page = await browser.newPage({
    viewport: { width: 1280, height: 840 },
  });
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(server.resolvedUrls.local[0]);
  await page
    .getByRole("heading", { name: "Make room for curiosity." })
    .waitFor();
  assert.equal(
    await page.getByRole("main", { name: "Lunar browser workspace" }).count(),
    1,
  );
  assert.equal(
    await page.getByText(/Chromium tabs and profile data require/).count(),
    1,
  );
  const rect = await page.locator("#page-viewport").evaluate((node) => {
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  assert.ok(
    rect.y > 60 && rect.y < 150 && rect.height > 400,
    "Viewport follows actual menu and toolbar layout",
  );
  assert.ok(
    rect.y + rect.height <= 840 - 90,
    "Native viewport reserves dock space",
  );
  const address = await page
    .getByRole("textbox", { name: "Address and search" })
    .boundingBox();
  assert.ok(address);
  const target = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("aria-label"),
    { x: address.x + address.width / 2, y: address.y + address.height / 2 },
  );
  assert.equal(
    target,
    "Address and search",
    "No desktop surface or invisible shortcuts cover browser controls",
  );
  fs.mkdirSync(".artifacts/ui", { recursive: true });
  await page.screenshot({ path: ".artifacts/ui/start.png" });
  await page.getByRole("button", { name: "Show desktop", exact: true }).click();
  await page
    .getByRole("button", { name: "Open websites", exact: true })
    .dblclick();
  await page.getByRole("dialog", { name: "Websites", exact: true }).waitFor();
  await page.screenshot({ path: ".artifacts/ui/desktop.png" });
  await page
    .getByRole("navigation", { name: "Dock" })
    .getByRole("button", { name: "Lunar Browser", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Make room for curiosity." })
    .waitFor();
  assert.equal(
    await page.getByRole("main", { name: "Lunar browser workspace" }).count(),
    1,
  );
  await page
    .getByRole("navigation", { name: "Dock" })
    .getByRole("button", { name: "Theme Studio", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Theme Studio", exact: true })
    .waitFor();
  await page.screenshot({ path: ".artifacts/ui/theme-studio.png" });
  await page.setViewportSize({ width: 900, height: 650 });
  await page.screenshot({ path: ".artifacts/ui/compact.png" });
  assert.deepEqual(
    failures,
    [],
    "No renderer exceptions, duplicate keys or console errors",
  );
  console.log(
    "PASS: Chromium renderer preview — single workspace, real layout/hit targets, original shortcuts, dock restore, Theme Studio, resize; no console errors.",
  );
  console.log(
    "This test is not a native Electron or Windows runtime test. Screenshots: .artifacts/ui/",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

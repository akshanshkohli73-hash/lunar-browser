import assert from "node:assert/strict";
import fs from "node:fs";
import { preview } from "vite";
import { chromium } from "playwright-core";
import { expect } from "@playwright/test";
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
  // These are real browser-computed styles, not jsdom layout guesses.
  const calendar = page.getByRole("article", { name: "Calendar widget" });
  assert.equal(
    await calendar.evaluate((node) => getComputedStyle(node).display),
    "flex",
    "The outer calendar widget must not inherit its inner seven-column grid",
  );
  assert.equal(
    await calendar
      .locator(".calendar-days")
      .evaluate(
        (node) =>
          getComputedStyle(node).gridTemplateColumns.split(/\s+/u).length,
      ),
    7,
  );
  await page
    .getByRole("button", { name: "Customize dashboard", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Customize dashboard",
    exact: true,
  });
  await editor
    .getByRole("button", { name: "Rose stationery", exact: true })
    .click();
  await editor
    .getByRole("combobox", { name: "Dock size", exact: true })
    .selectOption("compact");
  await expect(page.locator("html")).toHaveAttribute(
    "data-dock-size",
    "compact",
  );
  await expect(
    page.getByRole("region", { name: "New tab dashboard" }),
  ).toHaveAttribute("data-wallpaper-preset", "rose");
  await editor
    .getByRole("combobox", { name: "Widget to add" })
    .selectOption("shortcuts");
  await editor.getByRole("button", { name: "Add widget", exact: true }).click();
  assert.equal(
    await page
      .getByRole("article", { name: "Shortcut tiles widget" })
      .evaluate((node) => getComputedStyle(node).display),
    "flex",
    "Shortcut tile layout must not leak onto its container",
  );
  assert.equal(
    await editor
      .getByRole("button", { name: "Apply dashboard", exact: true })
      .isDisabled(),
    true,
    "A renderer-only preview must not pretend to save a desktop profile",
  );
  await page.screenshot({ path: ".artifacts/ui/dashboard-editor.png" });
  await editor
    .getByRole("button", { name: "Cancel dashboard changes", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-dock-size",
    "comfortable",
  );
  await expect(
    page.getByRole("region", { name: "New tab dashboard" }),
  ).toHaveAttribute("data-wallpaper-preset", "meadow");
  assert.equal(
    await page.getByRole("article", { name: "Shortcut tiles widget" }).count(),
    0,
  );

  const panels = [
    ["Home", "Make room for curiosity."],
    ["Widgets", "Widgets"],
    ["Appearance", "Theme Studio"],
    ["Lunar Shield", "Lunar Shield"],
    ["Library", "Saved for later"],
    ["Activity", "Where you’ve been"],
    ["Downloads", "Downloads"],
    ["Extensions", "Extensions"],
    ["Settings", "Browsing"],
  ];
  const dock = page.getByRole("navigation", { name: "Dock" });
  assert.deepEqual(
    await dock
      .getByRole("button")
      .allTextContents()
      .then((items) => items.map((s) => s.trim())),
    panels.map((p) => p[0]),
  );
  for (const [name, heading] of panels) {
    await dock.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("heading", { name: heading, exact: true })
      .first()
      .waitFor();
    assert.equal(
      await page.getByRole("main", { name: "Lunar browser workspace" }).count(),
      1,
    );
  }
  await page.getByRole("button", { name: "Show desktop", exact: true }).click();
  assert.equal(
    await page
      .getByRole("region", { name: "Lunar desktop controls" })
      .getByRole("button")
      .count(),
    9,
  );
  await page.screenshot({ path: ".artifacts/ui/desktop.png" });
  await page
    .getByRole("button", { name: "Open Appearance", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Theme Studio", exact: true })
    .waitFor();
  await page.screenshot({ path: ".artifacts/ui/theme-studio.png" });
  const menus = [
    "Lunar",
    "File",
    "Edit",
    "View",
    "History",
    "Bookmarks",
    "Window",
    "Help",
  ];
  for (const menu of menus) {
    await page
      .getByRole("menubar", { name: "Application menu" })
      .getByRole("menuitem", { name: menu, exact: true })
      .click();
    await page
      .getByRole("menu", { name: `${menu} menu`, exact: true })
      .waitFor();
    await page
      .getByRole("menu", { name: `${menu} menu`, exact: true })
      .press("Escape");
  }
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Lunar", exact: true })
    .click();
  await page
    .getByRole("menu", { name: "Lunar menu" })
    .getByRole("menuitem", { name: "Lunar controls", exact: true })
    .click();
  const launcher = page.getByRole("dialog", { name: "Lunar controls" });
  await launcher
    .getByRole("textbox", { name: "Find a Lunar control" })
    .fill("widgets");
  await launcher
    .getByRole("textbox", { name: "Find a Lunar control" })
    .press("Enter");
  await page.getByRole("heading", { name: "Widgets", exact: true }).waitFor();
  await dock.getByRole("button", { name: "Home", exact: true }).click();
  await page.setViewportSize({ width: 700, height: 650 });
  await page
    .getByRole("heading", { name: "Make room for curiosity." })
    .waitFor();
  const cells = await page.locator(".dashboard-widget").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: Math.round(rect.left), right: Math.round(rect.right) };
    }),
  );
  assert.ok(
    cells.every(
      (cell) => cell.left === cells[0].left && cell.right === cells[0].right,
    ),
    "Narrow dashboards stack the same saved cells without horizontal overlap",
  );

  const checkDockTargets = async () => {
    const targets = await page
      .getByRole("navigation", { name: "Dock" })
      .getByRole("button")
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        }),
      );
    assert.ok(
      targets.every((target) => target.left >= 0 && target.right <= 700),
      "Every dock button remains inside the viewport, including during magnification",
    );
  };
  await checkDockTargets();
  await page
    .getByRole("navigation", { name: "Dock" })
    .getByRole("button")
    .last()
    .hover();
  await checkDockTargets();
  await page.screenshot({ path: ".artifacts/ui/compact-dashboard.png" });
  assert.deepEqual(
    failures,
    [],
    "No renderer exceptions, duplicate keys or console errors",
  );
  console.log(
    "PASS: Chromium renderer preview — single workspace, real layout/hit targets, all nine Lunar shortcuts and launcher routes, eight keyboard menus, dock restore, Theme Studio, wallpaper/widget/dock preview/cancel and responsive stacking; no console errors.",
  );
  console.log(
    "This test is not a native Electron or Windows runtime test. Screenshots: .artifacts/ui/",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

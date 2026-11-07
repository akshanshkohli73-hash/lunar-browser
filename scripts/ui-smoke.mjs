import assert from "node:assert/strict";
import {
  checkCustomizationLayout,
  checkDashboardScroll,
} from "./material-layout-checks.mjs";
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
  await checkCustomizationLayout(
    page,
    editor,
    ".artifacts/ui/customize-1280x840",
  );
  for (const [width, height] of [
    [800, 600],
    [700, 650],
    [520, 500],
  ]) {
    await page.setViewportSize({ width, height });
    await checkCustomizationLayout(
      page,
      editor,
      `.artifacts/ui/customize-${width}x${height}`,
    );
  }
  await page.setViewportSize({ width: 1280, height: 840 });
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
  const glass = page.locator('[data-widget-id="notes"] > .glass-surface');
  assert.match(
    await glass.evaluate((node) => getComputedStyle(node).backdropFilter),
    /blur\(16px\)/u,
  );
  assert.equal(
    await glass.evaluate(
      (node) => getComputedStyle(node, "::before").pointerEvents,
    ),
    "none",
  );
  const oldBackground = await glass.evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  );
  const opacity = editor.getByRole("slider", {
    name: "Glass opacity",
    exact: true,
  });
  await opacity.focus();
  await opacity.press("Home");
  for (let n = 0; n < 4; n++) await opacity.press("ArrowRight");
  await expect(glass).toHaveCSS("--glass-opacity", "0.64");
  assert.notEqual(
    await glass.evaluate((node) => getComputedStyle(node).backgroundColor),
    oldBackground,
    "Opacity must affect the actual rendered material",
  );
  const blur = editor.getByRole("slider", {
    name: "Blur intensity",
    exact: true,
  });
  await blur.focus();
  await blur.press("Home");
  for (let n = 0; n < 20; n++) await blur.press("ArrowRight");
  await expect(glass).toHaveCSS("backdrop-filter", "blur(23px) saturate(1.12)");
  await editor
    .getByRole("combobox", { name: "Glass rendering mode", exact: true })
    .selectOption("simple");
  await expect(glass).toHaveCSS("backdrop-filter", "none");
  assert.equal(await blur.isDisabled(), true);
  const simpleBackground = await glass.evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  );
  await opacity.focus();
  await opacity.press("ArrowRight");
  await expect(glass).toHaveCSS("--glass-opacity", "0.65");
  assert.notEqual(
    await glass.evaluate((node) => getComputedStyle(node).backgroundColor),
    simpleBackground,
    "Simple mode must still honor the saved opacity preference",
  );
  await opacity.press("ArrowLeft");
  await expect(glass).toHaveCSS("--glass-opacity", "0.64");
  await editor
    .getByRole("combobox", { name: "Glass rendering mode", exact: true })
    .selectOption("balanced");
  await editor
    .getByRole("checkbox", { name: "Enable Liquid Glass", exact: true })
    .uncheck();
  await expect(glass).toHaveAttribute("data-glass-mode", "solid");
  await expect(glass).toHaveCSS("backdrop-filter", "none");
  await editor
    .getByRole("checkbox", { name: "Enable Liquid Glass", exact: true })
    .check();
  // Show all existing kinds, with no fake provider responses or privileged bridge.
  for (const kind of ["weather", "recent", "focus"]) {
    await editor
      .getByRole("combobox", { name: "Widget to add" })
      .selectOption(kind);
    await editor
      .getByRole("button", { name: "Add widget", exact: true })
      .click();
  }
  await expect(page.locator(".dashboard-widget > .glass-surface")).toHaveCount(
    9,
  );
  for (const [id, level, filter] of [
    ["clock", "light", "blur(15px) saturate(1.22)"],
    ["search", "standard", "blur(20px) saturate(1.18)"],
    ["notes", "deep", "blur(23px) saturate(1.12)"],
  ]) {
    const surface = page.locator(`[data-widget-id="${id}"] > .glass-surface`);
    await expect(surface).toHaveAttribute("data-glass-level", level);
    await expect(surface).toHaveCSS("backdrop-filter", filter);
    assert.ok(
      Number(
        await surface.evaluate((node) =>
          getComputedStyle(node).getPropertyValue("--glass-alpha"),
        ),
      ) < 0.7,
      "Balanced glass must not regress to an opaque white card",
    );
  }
  for (const kind of [
    "clock",
    "search",
    "bookmarks",
    "weather",
    "calendar",
    "notes",
    "recent",
    "shortcuts",
    "focus",
  ])
    await expect(
      page.locator(`.dashboard-widget.widget-${kind} > .glass-surface`),
    ).toHaveCount(1);
  for (const preset of ["Coquette meadow", "Midnight garden"]) {
    await editor.getByRole("button", { name: preset, exact: true }).click();
    const text = editor.getByRole("combobox", {
      name: "Dashboard text",
      exact: true,
    });
    await text.selectOption(preset === "Midnight garden" ? "light" : "dark");
    await expect(glass).toHaveAttribute(
      "data-glass-tone",
      preset === "Midnight garden" ? "dark" : "light",
    );
    await expect(
      page.getByRole("region", { name: "New tab dashboard" }),
    ).toHaveAttribute(
      "data-wallpaper-preset",
      preset === "Midnight garden" ? "midnight" : "meadow",
    );
    await page
      .locator(".new-tab-dashboard .dashboard-wallpaper img")
      .evaluate((image) => image.decode());
    const caption = await page
      .locator(".dashboard-widget .widget-clock .eyebrow")
      .evaluate((node) => {
        const style = getComputedStyle(node),
          reference = document.createElement("span");
        reference.style.color = style.getPropertyValue("--glass-muted");
        return { actual: style.color, expected: reference.style.color };
      });
    assert.equal(
      caption.actual,
      caption.expected,
      "Every glass caption must use readable material ink, even on dark glass",
    );

    // Isolate the actual draft dashboard for visual review; no persisted save is implied.
    await page.screenshot({
      path: `.artifacts/ui/glass-${preset === "Midnight garden" ? "dark" : "bright"}-preview.png`,
      style: ".modal-backdrop {visibility:hidden!important}",
    });
  }
  for (const mode of ["simple", "balanced"]) {
    await editor
      .getByRole("combobox", { name: "Glass rendering mode", exact: true })
      .selectOption(mode);
    await page.emulateMedia({ forcedColors: "active" });
    await expect(glass).toHaveCSS("backdrop-filter", "none");
    await expect(glass).toHaveCSS("background-image", "none");
    await page.emulateMedia({ forcedColors: "none" });
  }
  for (let n = 0; n < 11; n++) {
    await editor
      .getByRole("combobox", { name: "Widget to add" })
      .selectOption("clock");
    await editor
      .getByRole("button", { name: "Add widget", exact: true })
      .click();
  }
  await expect(page.locator(".dashboard-widget > .glass-surface")).toHaveCount(
    20,
  );
  assert.equal(
    await editor
      .getByRole("button", { name: "Add widget", exact: true })
      .isDisabled(),
    true,
  );
  await checkDashboardScroll(page);
  // All 20 materials really enter the viewport here, rather than counting offscreen DOM nodes.
  await page.setViewportSize({ width: 1280, height: 2800 });
  const visibleSurfaces = await page
    .locator(".dashboard-widget > .glass-surface")
    .evaluateAll(
      (nodes) =>
        nodes.filter((node) => {
          const r = node.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= innerHeight - 96;
        }).length,
    );
  assert.equal(visibleSurfaces, 20);
  await page.screenshot({
    path: ".artifacts/ui/twenty-visible-materials.png",
    style: ".modal-backdrop{visibility:hidden!important}",
  });
  await page.setViewportSize({ width: 1280, height: 840 });
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
  await expect(dock.locator(".lunar-dock-material")).toHaveAttribute(
    "data-glass-level",
    "light",
  );
  // Actual pointer and keyboard feedback, with motion enabled and then reduced.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const home = dock.getByRole("button", { name: "Home", exact: true });
  const hitBox = await home.boundingBox();
  await home.hover();
  await expect
    .poll(() =>
      home
        .locator(".lunar-dock-art")
        .evaluate((node) => getComputedStyle(node).transform),
    )
    .toBe("matrix(1.07, 0, 0, 1.07, 0, -3)");
  assert.deepEqual(
    await home.boundingBox(),
    hitBox,
    "Magnification must not move the dock hit target",
  );
  await home.focus();
  await home.press("Tab");
  await expect(
    dock.getByRole("button", { name: "Widgets", exact: true }),
  ).toBeFocused();
  await expect(
    dock.getByRole("button", { name: "Widgets", exact: true }),
  ).toHaveCSS("outline-style", "solid");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(home.locator(".lunar-dock-art")).toHaveCSS("transform", "none");
  assert.deepEqual(
    await dock
      .getByRole("button")
      .allTextContents()
      .then((items) => items.map((s) => s.trim())),
    panels.map((p) => p[0]),
  );
  for (const [name, heading] of panels) {
    await dock.getByRole("button", { name, exact: true }).click();
    await expect(
      dock.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    assert.equal(await dock.locator(".cdp-run").count(), 1);
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
  await page
    .getByRole("button", { name: "Background & dock", exact: true })
    .click();
  const magnify = page.getByRole("checkbox", {
    name: "Dock magnification",
    exact: true,
  });
  await magnify.uncheck();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await dock.getByRole("button", { name: "Home", exact: true }).hover();
  await expect(home.locator(".lunar-dock-art")).toHaveCSS("transform", "none");
  await magnify.check();
  await page
    .getByRole("button", { name: "Cancel dashboard changes", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
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
  await checkDashboardScroll(page);
  await page.screenshot({ path: ".artifacts/ui/compact-dashboard.png" });
  await page.setViewportSize({ width: 520, height: 500 });
  await checkDashboardScroll(page);
  const smallTargets = await dock.getByRole("button").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth;
    }),
  );
  assert.ok(
    smallTargets.every(Boolean),
    "All nine dock icons remain reachable at 520px",
  );
  await page.screenshot({ path: ".artifacts/ui/small-dashboard.png" });
  assert.deepEqual(
    failures,
    [],
    "No renderer exceptions, duplicate keys or console errors",
  );
  console.log(
    "PASS: Chromium renderer preview — single workspace, real layout/hit targets, all nine Lunar shortcuts and launcher routes, eight keyboard menus, dock restore, Theme Studio, wallpaper/widget/dock preview/cancel, real glass controls / modes, bright/dark draft previews, forced-color fallback, twenty actually visible static materials, three shared depths, fixed-wallpaper scrolling, independently scrolling customization with fixed actions at four sizes, dock pointer/keyboard/motion settings and responsive stacking; no console errors.",
  );
  console.log(
    "This test is not a native Electron or Windows runtime test. Screenshots: .artifacts/ui/",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

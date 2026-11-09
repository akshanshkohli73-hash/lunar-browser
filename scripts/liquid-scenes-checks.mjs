// Additional actual production-renderer scenes, not a renderer/mock graphics implementation.
import assert from "node:assert/strict";
import fs from "node:fs";
import { expect } from "@playwright/test";
import { liquidMetrics, stableLiquidPixels } from "./liquid-engine-checks.mjs";
export async function checkLiquidScenes(browser, url, evidence) {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 840 },
    }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute(
      "data-liquid-engine",
      "webgl2",
      { timeout: 20000 },
    );
    await page.evaluate(() => {
      window.__liquidSceneBoxes = [];
      window.__liquidSceneObserver = new MutationObserver(() => {
        const proxy = document.querySelector(
          '[data-liquid-morph-target="panel-themestudio"]',
        );
        if (!proxy || window.__liquidSceneBoxes.length >= 100) return;
        const r = proxy.getBoundingClientRect();
        if (r.width > 0)
          window.__liquidSceneBoxes.push({
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
          });
      });
      window.__liquidSceneObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["style"],
      });
    });
    const dock = page.getByRole("navigation", { name: "Dock", exact: true });
    await dock.getByRole("button", { name: "Appearance", exact: true }).click();
    await page
      .getByRole("heading", { name: "Theme Studio", exact: true })
      .waitFor();
    await expect
      .poll(() => page.evaluate(() => window.__liquidSceneBoxes.length), {
        timeout: 15000,
      })
      .toBeGreaterThan(1);
    await expect(
      page.locator('[data-liquid-morph-target="panel-themestudio"]'),
    ).toHaveCount(0, { timeout: 15000 });
    const boxes = await page.evaluate(() => {
      window.__liquidSceneObserver.disconnect();
      return window.__liquidSceneBoxes;
    });
    assert.ok(
      Math.max(...boxes.map((r) => r.width)) -
        Math.min(...boxes.map((r) => r.width)) >
        100,
      "Dock material must expand into the corresponding panel heading",
    );
    await page.screenshot({ path: `${evidence}-dock-morph-scene.png` });
    await dock.getByRole("button", { name: "Home", exact: true }).click();
    await page
      .getByRole("button", { name: "Customize dashboard", exact: true })
      .click();
    const editor = page.getByRole("dialog", {
        name: "Customize dashboard",
        exact: true,
      }),
      before = await liquidMetrics(page);
    await editor
      .getByRole("button", { name: "Midnight garden", exact: true })
      .click();
    const sample = editor.locator(".glass-preview-sample");
    await expect(sample).toHaveAttribute("data-glass-tone", "dark");
    await expect
      .poll(async () => (await liquidMetrics(page)).textureUploads, {
        timeout: 15000,
      })
      .toBeGreaterThan(before.textureUploads);
    const selected = editor.getByRole("button", {
      name: "Midnight garden",
      exact: true,
    });
    await selected.hover();
    const selectedContrast = await selected.evaluate((node) => {
      const css = getComputedStyle(node),
        canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.fillStyle = css.color;
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = css.backgroundColor;
      context.fillRect(1, 0, 1, 1);
      const rgba = context.getImageData(0, 0, 2, 1).data;
      const luminance = (offset) =>
        [0, 1, 2]
          .map((i) => {
            const c = rgba[offset + i] / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
      const a = luminance(0),
        b = luminance(4);
      return {
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        foreground: css.color,
        background: css.backgroundColor,
        backgroundAlpha: rgba[7],
      };
    });
    assert.ok(
      selectedContrast.ratio >= 4.5 && selectedContrast.backgroundAlpha === 255,
      "Hovered selected wallpaper text must retain normal-text contrast",
    );
    const pixels = await stableLiquidPixels(sample);
    assert.ok(pixels.visible > 0);
    const ink = await sample.evaluate((node) => getComputedStyle(node).color);
    assert.equal(ink, "rgb(244, 248, 239)");
    await page.screenshot({ path: `${evidence}-dark-scene.png` });
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${evidence}-scenes.json`,
      JSON.stringify(
        {
          dockMorph: boxes,
          dark: {
            pixels,
            ink,
            selectedContrast,
            metrics: await liquidMetrics(page),
          },
          errors,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await page.close();
  }
}

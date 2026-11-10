// Actual production-browser comparisons. No app-only test hooks or graphics stand-ins.
import assert from "node:assert/strict";
import fs from "node:fs";
import { expect } from "@playwright/test";
import { liquidMetrics, stableLiquidPixels } from "./liquid-engine-checks.mjs";

const surfaces = {
  dock: ".lunar-dock > .lunar-dock-material",
  search: '[data-widget-id="search"] > .glass-surface',
  menubar: ".lunar-menubar > .glass-backing",
  toolbar: ".browser-toolbar > .glass-backing",
  address: ".address-bar > .glass-backing",
  notes: '[data-widget-id="notes"] > .glass-surface',
  calendar: '[data-widget-id="calendar"] > .glass-surface',
};
async function describeSurfaces(page, selectors = surfaces) {
  return page.evaluate(
    (selectors) =>
      Object.fromEntries(
        Object.entries(selectors).map(([name, selector]) => {
          const node = document.querySelector(selector);
          if (!node) throw new Error(`Missing real surface: ${name}`);
          const css = getComputedStyle(node),
            box = node.getBoundingClientRect();
          const color = document.createElement("canvas");
          color.width = color.height = 1;
          const context = color.getContext("2d", { willReadFrequently: true });
          context.fillStyle = css.backgroundColor;
          context.fillRect(0, 0, 1, 1);
          const alpha = context.getImageData(0, 0, 1, 1).data[3] / 255;
          return [
            name,
            {
              identity: node.dataset.pearlIdentity,
              role: node.dataset.materialRole,
              variant: node.dataset.materialVariant,
              mode: node.dataset.glassMode,
              rect: {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
              },
              border: [
                css.borderTopWidth,
                css.borderRightWidth,
                css.borderBottomWidth,
                css.borderLeftWidth,
              ],
              radius: [
                css.borderTopLeftRadius,
                css.borderTopRightRadius,
                css.borderBottomRightRadius,
                css.borderBottomLeftRadius,
              ],
              spacing: [css.padding, css.margin, css.gap],
              ink: css.color,
              background: css.backgroundColor,
              alpha,
              gradient: css.backgroundImage,
              shadow: css.boxShadow,
              filter: css.filter,
              backdrop: css.backdropFilter,
              before: {
                events: getComputedStyle(node, "::before").pointerEvents,
                animation: getComputedStyle(node, "::before").animationName,
              },
              outputCanvases: node.querySelectorAll(
                ":scope > canvas[data-liquid-output]",
              ).length,
            },
          ];
        }),
      ),
    selectors,
  );
}
function sameLayout(before, after) {
  assert.deepEqual(Object.keys(after), Object.keys(before));
  for (const [name, a] of Object.entries(before)) {
    const b = after[name];
    for (const key of ["x", "y", "width", "height"])
      assert.ok(
        Math.abs(a.rect[key] - b.rect[key]) <= 0.1,
        `${name}: ${key} changed across backend switch: ${JSON.stringify({ a: a.rect, b: b.rect })}`,
      );
    for (const key of ["identity", "role", "radius", "border", "spacing"])
      assert.deepEqual(b[key], a[key], `${name}: retained ${key}`);
  }
}
function intentionalCss(snapshot) {
  for (const [name, s] of Object.entries(snapshot)) {
    assert.equal(
      s.variant,
      name === "address" ? "clear-surface" : "pearl-css",
      name,
    );
    assert.equal(s.filter, "none", `${name}: never distort content`);
    assert.doesNotMatch(
      s.backdrop,
      /url\(/u,
      `${name}: no displacement fallback`,
    );
    if (s.backdrop !== "none") {
      const radius = Number(/blur\(([\d.]+)px\)/u.exec(s.backdrop)?.[1]);
      assert.ok(
        Number.isFinite(radius) && radius <= 12,
        `${name}: controlled CSS blur, got ${s.backdrop}`,
      );
    }
    assert.ok(
      s.alpha > 0.25,
      `${name}: must not become an unreadable transparent hole`,
    );
    assert.notEqual(
      s.gradient,
      "none",
      `${name}: intentional layered pearl paint`,
    );
    assert.equal(s.before.events, "none");
    assert.equal(
      s.before.animation,
      "none",
      `${name}: no perpetual decorative loop`,
    );
  }
  assert.equal(
    snapshot.address.backdrop,
    "none",
    "Nested address control must not add a backdrop pass",
  );
  assert.notEqual(
    snapshot.dock.gradient,
    snapshot.notes.gradient,
    "Dock and reading widgets are not the same frosted card",
  );
  assert.notEqual(
    snapshot.dock.shadow,
    snapshot.toolbar.shadow,
    "Chrome and floating dock retain hierarchy",
  );
}
async function loseContext(page) {
  await page.locator("canvas[data-liquid-renderer]").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension)
      throw new Error("Actual context-loss extension is required");
    canvas.__pearlContext = extension;
    extension.loseContext();
  });
  await expect(page.locator("html")).toHaveAttribute(
    "data-liquid-reason",
    "context-lost",
  );
}
async function restoreContext(page) {
  await page
    .locator("canvas[data-liquid-renderer]")
    .evaluate((canvas) => canvas.__pearlContext.restoreContext());
  await expect(page.locator("html")).toHaveAttribute(
    "data-liquid-engine",
    "webgl2",
    { timeout: 20000 },
  );
}
async function noDistortedContent(page) {
  const invalid = await page
    .locator(
      ".address-bar input, .dashboard-widget input, .dashboard-widget textarea, .lunar-dock svg, .lunar-menubar > nav > button",
    )
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => getComputedStyle(node).filter !== "none")
        .map((node) => node.outerHTML.slice(0, 120)),
    );
  assert.deepEqual(
    invalid,
    [],
    "Text, inputs and icons must not have distortion filters",
  );
  await expect(
    page.locator(
      "filter, feTurbulence, feDisplacementMap, .glass-optical-defs",
    ),
  ).toHaveCount(0);
}
/** Uses the real Electron shell (enabled native address field), not a preview bridge. */
export async function checkNativeMaterialSwitch(page, evidence) {
  const address = page.getByRole("textbox", {
    name: "Address and search",
    exact: true,
  });
  const notes = page.locator(surfaces.notes);
  await expect(address).toBeEnabled();
  await page.mouse.move(0, 0);
  await stableLiquidPixels(notes);
  const originalAddress = await address.inputValue();
  await address.fill("https://lunar.example/retained-material-draft");
  await address.evaluate((node) => {
    window.__pearlNativeAddress = node;
    node.setSelectionRange(8, 13);
  });
  const before = await describeSurfaces(page);
  await loseContext(page);
  const css = await describeSurfaces(page);
  sameLayout(before, css);
  intentionalCss(css);
  await noDistortedContent(page);
  await expect(address).toBeFocused();
  await expect(address).toHaveValue(
    "https://lunar.example/retained-material-draft",
  );
  assert.equal(
    await address.evaluate(
      (node) =>
        node === window.__pearlNativeAddress &&
        node.selectionStart === 8 &&
        node.selectionEnd === 13,
    ),
    true,
    "Native address draft/focus/selection must survive GPU loss",
  );
  await page.screenshot({
    path: `${evidence}-pearl-context-lost.png`,
    caret: "hide",
  });
  await restoreContext(page);
  const pixels = await stableLiquidPixels(notes);
  assert.ok(pixels.visible > pixels.width * pixels.height * 0.75);
  sameLayout(before, await describeSurfaces(page));
  await expect(address).toBeFocused();
  await expect(address).toHaveValue(
    "https://lunar.example/retained-material-draft",
  );
  await address.fill(originalAddress);
  await address.press("Escape");
  fs.writeFileSync(
    `${evidence}-pearl-switch.json`,
    JSON.stringify(
      {
        before,
        css,
        restoredPixels: pixels,
        retainedAddressDraft: true,
        noSvg: true,
      },
      null,
      2,
    ) + "\n",
  );
}

export async function checkPearlMaterials(browser, url, evidence) {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 840 },
    }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const observations = {};
  try {
    await page.emulateMedia({
      reducedMotion: "no-preference",
      forcedColors: "none",
    });
    await page.goto(url);
    const notes = page.locator(surfaces.notes);
    const pixels = await stableLiquidPixels(notes);
    assert.ok(pixels.visible > pixels.width * pixels.height * 0.75);
    await page.mouse.move(0, 0);
    await stableLiquidPixels(notes);
    await page.evaluate((selectors) => {
      for (const [name, selector] of Object.entries(selectors))
        document.querySelector(selector).dataset.pearlIdentity = name;
    }, surfaces);
    const original = await describeSurfaces(page);
    for (const [name, s] of Object.entries(original)) {
      assert.equal(
        s.variant,
        name === "address" ? "clear-surface" : "liquid-webgl",
        `${name}: automatic live backend`,
      );
      assert.equal(
        s.backdrop,
        "none",
        `${name}: WebGL and Clear Surface must not stack a CSS backdrop pass`,
      );
      if (name === "address")
        assert.equal(
          s.outputCanvases,
          0,
          "No useless GPU/2D output allocation for Clear Surface",
        );
    }
    assert.equal((await liquidMetrics(page)).contexts, 1);
    await page.screenshot({ path: `${evidence}-webgl.png`, caret: "hide" });

    // The renderer preview intentionally disables native navigation. Exercise the
    // actual editable note here; native address behaviour stays in native-smoke.
    const address = page.getByRole("textbox", {
      name: "Address and search",
      exact: true,
    });
    await expect(address).toBeDisabled();
    const note = page.getByRole("textbox", {
      name: "Dashboard note",
      exact: true,
    });
    await note.fill("My note survives the material switch.");
    await note.evaluate((node) => {
      window.__pearlDraft = node;
      node.setSelectionRange(6, 11);
    });
    await loseContext(page);
    const css = await describeSurfaces(page);
    sameLayout(original, css);
    intentionalCss(css);
    await noDistortedContent(page);
    await expect(address).toBeDisabled();
    await expect(note).toBeFocused();
    assert.equal(
      await note.evaluate(
        (node) =>
          node === window.__pearlDraft &&
          node.selectionStart === 6 &&
          node.selectionEnd === 11,
      ),
      true,
      "Context loss must not remount or disturb a real focused editor",
    );
    await expect(note).toHaveValue("My note survives the material switch.");
    await page.screenshot({
      path: `${evidence}-css-context-lost.png`,
      caret: "hide",
    });
    const still = await liquidMetrics(page);
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 350)),
    );
    assert.equal(
      (await liquidMetrics(page)).draws,
      still.draws,
      "A lost GPU must not leave an animation/render loop",
    );
    await restoreContext(page);
    const restored = await stableLiquidPixels(notes);
    assert.ok(
      restored.visible > restored.width * restored.height * 0.75,
      "Restoration must paint actual pixels, not just change the backend label",
    );
    sameLayout(original, await describeSurfaces(page));
    await expect(note).toHaveValue("My note survives the material switch.");

    // Exercise the real DOM material intent consumed by the engine, not a second renderer.
    await notes.evaluate(
      (node) => (node.dataset.materialRequest = "pearl-css"),
    );
    await expect(notes).toHaveAttribute("data-material-variant", "pearl-css");
    await expect(
      notes.locator(":scope > canvas[data-liquid-output]"),
    ).toHaveCount(0);
    await notes.evaluate(
      (node) => (node.dataset.materialRequest = "liquid-webgl"),
    );
    await stableLiquidPixels(notes);
    await expect(
      notes.locator(":scope > canvas[data-liquid-output]"),
    ).toHaveCount(1);

    // Floating menu: compare the SAME mounted menu and focused item before/after loss.
    await page.locator('[data-top-menu="Lunar"]').click();
    const menu = page.getByRole("menu", { name: "Lunar menu", exact: true });
    const menuBacking = menu.locator(":scope > .glass-backing");
    await expect(page.locator("canvas[data-liquid-proxy]")).toHaveCount(0, {
      timeout: 15000,
    });
    await stableLiquidPixels(menuBacking);
    await menu.press("End");
    const settings = menu.getByRole("menuitem", {
      name: "Settings…",
      exact: true,
    });
    await expect(settings).toBeFocused();
    const menuSelectors = {
      menu: '.lunar-dropdown[role="menu"] > .glass-backing',
    };
    const menuGl = await describeSurfaces(page, menuSelectors);
    await page.screenshot({
      path: `${evidence}-menu-webgl.png`,
      caret: "hide",
    });
    await loseContext(page);
    const menuCss = await describeSurfaces(page, menuSelectors);
    sameLayout(menuGl, menuCss);
    assert.equal(menuCss.menu.variant, "pearl-css");
    assert.ok(menuCss.menu.alpha > 0.7);
    await expect(settings).toBeFocused();
    await page.screenshot({ path: `${evidence}-menu-css.png`, caret: "hide" });
    await restoreContext(page);
    await stableLiquidPixels(menuBacking);
    await expect(settings).toBeFocused();
    await menu.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(page.locator('[data-top-menu="Lunar"]')).toBeFocused();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-material-motion",
      "reduced",
    );
    await expect(notes).toHaveAttribute("data-material-variant", "pearl-css");
    const reduced = await describeSurfaces(page);
    intentionalCss(reduced);
    sameLayout(original, reduced);
    await expect(page.locator("canvas[data-liquid-proxy]")).toHaveCount(0);
    await noDistortedContent(page);
    await page.screenshot({
      path: `${evidence}-reduced-motion.png`,
      caret: "hide",
    });
    observations.webgl = { original, pixels, restored };
    observations.contextLost = css;
    observations.menu = { webgl: menuGl, css: menuCss };
    observations.reducedMotion = reduced;
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
  // Cold start: getContext returning null is the real unsupported/disabled-GPU path.
  // Also cover no backdrop-filter, with stronger backing instead of a transparent UI.
  for (const blur of [true, false]) {
    const fallback = await browser.newPage({
        viewport: { width: 1280, height: 840 },
      }),
      failures = [];
    fallback.on("pageerror", (error) => failures.push(error.message));
    try {
      await fallback.addInitScript((blur) => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return String(type).includes("webgl")
            ? null
            : getContext.call(this, type, ...args);
        };
        if (!blur) CSS.supports = () => false;
      }, blur);
      await fallback.emulateMedia({ reducedMotion: "no-preference" });
      await fallback.goto(url);
      await expect(fallback.locator("html")).toHaveAttribute(
        "data-liquid-reason",
        "webgl2-unavailable",
      );
      await expect(fallback.locator(surfaces.notes)).toBeVisible();
      await noDistortedContent(fallback);
      await expect(fallback.locator("canvas[data-liquid-output]")).toHaveCount(
        0,
      );
      const state = await describeSurfaces(fallback);
      intentionalCss(state);
      if (!blur)
        for (const s of Object.values(state)) {
          assert.equal(s.backdrop, "none");
          assert.ok(s.alpha >= 0.84 - 1 / 255);
        }
      const notes = fallback.getByRole("textbox", {
        name: "Dashboard note",
        exact: true,
      });
      await notes.fill("Pearl CSS works without WebGL2.");
      await expect(notes).toHaveValue("Pearl CSS works without WebGL2.");
      await fallback.screenshot({
        path: `${evidence}-cold-${blur ? "css" : "no-blur"}.png`,
        caret: "hide",
      });
      await fallback.locator('[data-top-menu="Lunar"]').click();
      const menu = fallback.getByRole("menu", {
        name: "Lunar menu",
        exact: true,
      });
      await expect(menu.locator(":scope > .glass-backing")).toHaveAttribute(
        "data-material-variant",
        "pearl-css",
      );
      await menu.press("End");
      await expect(
        menu.getByRole("menuitem", { name: "Settings…", exact: true }),
      ).toBeFocused();
      await menu.press("Escape");
      await expect(menu).toHaveCount(0);
      observations[blur ? "coldCss" : "noBackdrop"] = state;
      assert.deepEqual(failures, []);
    } finally {
      await fallback.close();
    }
  }
  fs.writeFileSync(
    `${evidence}-comparison.json`,
    JSON.stringify(observations, null, 2) + "\n",
  );
}

// Real production UI, shader pixels and native API checks. Test-only tooling;
// never imported by the application or used to simulate a browser bridge.
import assert from "node:assert/strict";
import fs from "node:fs";
import { expect } from "@playwright/test";
import {
  liquidMetrics,
  liquidPixels,
  stableLiquidPixels,
} from "./liquid-engine-checks.mjs";
const presets = [
  { name: "Water Lens", opacity: "0.68", blur: "4", refraction: "0.32" },
  { name: "Pearl Glass", opacity: "0.76", blur: "9", refraction: "0.14" },
  { name: "Crystal", opacity: "0.64", blur: "0", refraction: "0.43" },
];
const slider = (scope, name) =>
  scope.getByRole("slider", { name, exact: true });
const dockAction = (page, name) =>
  page
    .getByRole("navigation", { name: "Dock", exact: true })
    .getByRole("button", { name, exact: true });
async function openEditor(page) {
  await page
    .getByRole("button", { name: "Customize dashboard", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Customize dashboard", exact: true });
}
async function checkPresetValues(editor, preset) {
  await editor.getByRole("button", { name: preset.name, exact: true }).click();
  await expect(
    editor.getByRole("button", { name: preset.name, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(slider(editor, "Glass opacity")).toHaveValue(preset.opacity);
  await expect(slider(editor, "Blur intensity")).toHaveValue(preset.blur);
  await expect(slider(editor, "Refraction intensity")).toHaveValue(
    preset.refraction,
  );
}
export async function checkAquaCoquette(browser, url, evidence) {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 840 },
    }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const observed = { presets: {}, errors };
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute(
      "data-liquid-engine",
      "webgl2",
      { timeout: 20000 },
    );
    await expect(page.locator(".lunar-greeting strong")).toHaveText(
      /^(Good (morning|afternoon|evening)\.|A quiet orbit\.)$/u,
    );
    const owner = page
      .locator("[data-wallpaper-owner='shell'] .dashboard-wallpaper > img")
      .first();
    // Strongly patterned actual source makes small, bounded optical changes observable.
    await owner.evaluate(async (image) => {
      window.__aquaImageOwner = image;
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 400;
      const context = canvas.getContext("2d");
      for (let y = 0; y < 400; y += 8)
        for (let x = 0; x < 640; x += 8) {
          context.fillStyle = ((x + y) / 8) % 2 ? "#193c43" : "#e6f7f3";
          context.fillRect(x, y, 8, 8);
        }
      image.src = canvas.toDataURL("image/png");
      await image.decode();
    });
    const editor = await openEditor(page),
      sample = editor.locator(".glass-preview-sample");
    await editor
      .getByRole("combobox", { name: "Render quality", exact: true })
      .selectOption("balanced");
    // Keep the Studio preview and shared environment on the identical real texture.
    await editor
      .locator(".dashboard-preview .dashboard-wallpaper > img")
      .evaluate(async (image) => {
        image.src = window.__aquaImageOwner.src;
        await image.decode();
      });
    for (const preset of presets) {
      await checkPresetValues(editor, preset);
      await page.mouse.move(1, 1);
      observed.presets[preset.name] = await stableLiquidPixels(sample);
    }
    assert.equal(
      new Set(Object.values(observed.presets).map((pixels) => pixels.hash))
        .size,
      3,
      "All three presets must change actual shader output, not only selection labels",
    );
    await editor
      .getByRole("combobox", { name: "Material motion", exact: true })
      .selectOption("subtle");
    await expect(slider(editor, "Animation speed")).toHaveValue("0.85");
    await expect(slider(editor, "Surface elasticity")).toHaveValue("0.18");
    await editor
      .getByRole("button", { name: "Lilac material tint", exact: true })
      .click();
    await expect(editor.getByLabel("Glass tint", { exact: true })).toHaveValue(
      "#d9c9e9",
    );
    await expect(editor.getByText(/Custom material ·/u)).toBeVisible();
    // Isolate the new finite ripple: no elasticity, moving light or edited content.
    for (const name of ["Surface elasticity", "Reflection intensity"]) {
      await slider(editor, name).focus();
      await slider(editor, name).press("Home");
    }
    await editor
      .getByRole("checkbox", { name: "Hover motion", exact: true })
      .uncheck();
    await sample.scrollIntoViewIfNeeded();
    let box = await sample.boundingBox();
    // The sample intentionally never intercepts input. Use a real press in
    // the wallpaper preview at its physical coordinates, not a forced click.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const before = await stableLiquidPixels(sample);
    box = await sample.boundingBox();
    await sample.evaluate((node) => {
      const canvas = node.querySelector(":scope > canvas[data-liquid-output]");
      window.__aquaRippleFrames = [];
      window.__aquaRippleObserver = new MutationObserver(() => {
        const ripple = JSON.parse(canvas.dataset.liquidRipple || "[0,0,0,0]");
        if (ripple[3] > 0 && window.__aquaRippleFrames.length < 100)
          window.__aquaRippleFrames.push(ripple);
      });
      window.__aquaRippleObserver.observe(canvas, {
        attributes: true,
        attributeFilter: ["data-liquid-ripple"],
      });
    });
    await page.mouse.down();
    await page.mouse.up();
    let during;
    await expect
      .poll(
        async () => {
          during = await liquidPixels(sample);
          const pulse = await sample
            .locator(":scope > canvas[data-liquid-output]")
            .getAttribute("data-liquid-ripple");
          return (
            JSON.parse(pulse || "[0,0,0,0]")[3] > 0 &&
            during.hash !== before.hash
          );
        },
        { timeout: 5000, intervals: [30, 50, 80] },
      )
      .toBe(true);
    const after = await stableLiquidPixels(sample);
    const ripples = await page.evaluate(() => {
      window.__aquaRippleObserver.disconnect();
      return window.__aquaRippleFrames;
    });
    assert.ok(
      ripples.length > 0 &&
        ripples.every((ripple) => ripple[2] < 0.85 && ripple[3] <= 1),
    );
    assert.deepEqual(
      await sample.boundingBox(),
      box,
      "Optical ripples cannot move or resize logical hit targets",
    );
    assert.deepEqual(
      [during.width, during.height],
      [before.width, before.height],
      "A resolution change must not masquerade as an optical ripple",
    );
    assert.equal(
      after.hash,
      before.hash,
      "A static wallpaper must return to its exact settled material pixels",
    );
    observed.ripple = {
      before,
      during,
      after,
      ripples,
      stationaryHitBox: true,
    };
    const idleBefore = await liquidMetrics(page);
    await page.waitForTimeout(300);
    const idleAfter = await liquidMetrics(page);
    assert.equal(
      idleBefore.draws,
      idleAfter.draws,
      "Settled Aqua glass must not leave a decorative render loop",
    );
    observed.idle = { before: idleBefore.draws, after: idleAfter.draws };
    await editor
      .getByRole("button", { name: "Cancel dashboard changes", exact: true })
      .click();
    await expect(page.locator(".modal-backdrop")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Show desktop", exact: true })
      .click();
    assert.equal(
      await owner.evaluate((image) => image === window.__aquaImageOwner),
      true,
    );
    await dockAction(page, "Appearance").click();
    assert.equal(
      await owner.evaluate((image) => image === window.__aquaImageOwner),
      true,
    );
    await page
      .getByRole("button", { name: "Your own touch", exact: true })
      .click();
    const intensity = slider(page, "Liquid intensity"),
      dock = page.locator(".lunar-dock-material");
    await intensity.focus();
    await intensity.press("Home");
    await expect(page.locator("html")).toHaveCSS(
      "--lunar-liquid-intensity",
      "0",
    );
    const off = await stableLiquidPixels(dock),
      uploads = (await liquidMetrics(page)).textureUploads;
    await expect(dock.locator("canvas[data-liquid-output]")).toHaveAttribute(
      "data-liquid-intensity",
      "0",
    );
    await intensity.focus();
    await intensity.press("End");
    await expect(page.locator("html")).toHaveCSS(
      "--lunar-liquid-intensity",
      "1",
    );
    const on = await stableLiquidPixels(dock);
    await expect(dock.locator("canvas[data-liquid-output]")).toHaveAttribute(
      "data-liquid-intensity",
      "1",
    );
    assert.notEqual(
      off.hash,
      on.hash,
      "The 0–100% intensity control must reach real optical rendering",
    );
    assert.equal(
      (await liquidMetrics(page)).textureUploads,
      uploads,
      "Changing intensity must not reload the wallpaper texture",
    );
    observed.intensity = { off, on, textureUploadsUnchanged: true };
    await page
      .getByRole("button", { name: "Cancel appearance preview", exact: true })
      .click();
    await expect(page.locator("html")).toHaveCSS(
      "--lunar-liquid-intensity",
      "0.85",
    );
    await dockAction(page, "Home").click();
    assert.equal(
      await owner.evaluate((image) => image === window.__aquaImageOwner),
      true,
    );
    assert.equal((await liquidMetrics(page)).contexts, 1);
    await expect(page.locator("[data-wallpaper-owner='shell']")).toHaveCount(1);
    await expect(
      page.locator("filter, feTurbulence, feDisplacementMap"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Open Lunar Shield", exact: true }),
    ).toBeDisabled();
    await page.screenshot({ path: `${evidence}-home.png` });
    observed.metrics = await liquidMetrics(page);
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${evidence}-aqua.json`,
      JSON.stringify(observed, null, 2) + "\n",
    );
  } finally {
    await page.close();
  }
}

export async function checkNativeAquaCoquette(ui, api, evidence) {
  const originalDashboard = await api("getDashboard"),
    originalSettings = (await api("bootstrap")).settings;
  let editor = await openEditor(ui);
  for (const preset of presets) await checkPresetValues(editor, preset);
  assert.deepEqual(
    await api("getDashboard"),
    originalDashboard,
    "Aqua live preview must not write the native profile",
  );
  await editor
    .getByRole("button", { name: "Cancel dashboard changes", exact: true })
    .click();
  assert.deepEqual(await api("getDashboard"), originalDashboard);
  editor = await openEditor(ui);
  await checkPresetValues(editor, presets[2]);
  await editor
    .getByRole("button", { name: "Apply dashboard", exact: true })
    .click();
  await expect(editor).toBeHidden();
  const saved = await api("getDashboard");
  assert.deepEqual(
    saved.widgets,
    originalDashboard.widgets,
    "Presets must retain sparse widget overrides, data and geometry",
  );
  assert.equal(saved.glass.blur, 0);
  assert.equal(saved.glass.refraction, 0.43);
  assert.deepEqual(saved.wallpaper, originalDashboard.wallpaper);
  await api("updateDashboard", { glass: originalDashboard.glass });
  await dockAction(ui, "Appearance").click();
  await ui.getByRole("button", { name: "Your own touch", exact: true }).click();
  const intensity = slider(ui, "Liquid intensity");
  await intensity.focus();
  await intensity.press("Home");
  for (let step = 0; step < 37; step++) await intensity.press("ArrowRight");
  await expect(ui.locator("html")).toHaveCSS(
    "--lunar-liquid-intensity",
    "0.37",
  );
  assert.deepEqual((await api("bootstrap")).settings, originalSettings);
  await ui
    .getByRole("button", { name: "Apply customization", exact: true })
    .click();
  await expect(
    ui.getByRole("status", { name: "Theme save status" }),
  ).toHaveText("Appearance saved to this profile.");
  assert.equal(
    (await api("bootstrap")).settings.customTheme.appearance.glassIntensity,
    0.37,
  );
  await api("updateSettings", {
    themeId: originalSettings.themeId,
    customTheme: originalSettings.customTheme,
  });
  await dockAction(ui, "Home").click();
  await expect(ui.locator("html")).toHaveCSS(
    "--lunar-liquid-intensity",
    "0.85",
  );
  await ui
    .getByRole("button", { name: "Open Lunar Shield", exact: true })
    .click();
  await expect(
    ui.getByRole("heading", { name: "Lunar Shield", exact: true }),
  ).toBeVisible();
  await dockAction(ui, "Home").click();
  fs.writeFileSync(
    `${evidence}-aqua-profile.json`,
    JSON.stringify(
      {
        previewDidNotWrite: true,
        cancelRestored: true,
        appliedPreset: saved.glass,
        preservedWidgets: true,
        savedIntensity: 0.37,
        shieldFooterRoutes: true,
      },
      null,
      2,
    ) + "\n",
  );
}

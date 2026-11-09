// Actual application/graphics checks, never imported into the renderer bundle.
import assert from "node:assert/strict";
import fs from "node:fs";
import { expect } from "@playwright/test";
export async function liquidMetrics(page) {
  return page
    .locator("canvas[data-liquid-renderer]")
    .evaluate((canvas) => JSON.parse(canvas.dataset.metrics || "null"));
}
export async function liquidPixels(surface) {
  return surface.evaluate((node) => {
    const canvas = node.querySelector(":scope > canvas[data-liquid-output]");
    if (!canvas || canvas.hidden || !canvas.width || !canvas.height)
      throw new Error("No visible Liquid Engine output");
    const pixels = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261,
      visible = 0;
    for (let i = 0; i < pixels.length; i++) {
      hash = Math.imul(hash ^ pixels[i], 16777619);
      if (i % 4 === 3 && pixels[i] > 0) visible++;
    }
    return {
      hash: hash >>> 0,
      width: canvas.width,
      height: canvas.height,
      visible,
      deformation: JSON.parse(canvas.dataset.deformation || "[0,0,0]"),
    };
  });
}
export async function stableLiquidPixels(surface) {
  await surface.scrollIntoViewIfNeeded();
  await expect(surface).toHaveAttribute("data-liquid-backend", "webgl2", {
    timeout: 15000,
  });
  let previous = "",
    same = 0,
    result;
  await expect
    .poll(
      async () => {
        result = await liquidPixels(surface);
        const key = JSON.stringify([result.hash, result.width, result.height]);
        same = key === previous ? same + 1 : 0;
        previous = key;
        return same >= 2;
      },
      { timeout: 15000, intervals: [60, 80, 100] },
    )
    .toBe(true);
  return result;
}
export async function checkLiquidEngine(browser, url, evidence) {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 840 },
    }),
    failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  try {
    await page.emulateMedia({
      reducedMotion: "no-preference",
      forcedColors: "none",
    });
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute(
      "data-liquid-engine",
      "webgl2",
      { timeout: 20000 },
    );
    const initial = await liquidMetrics(page);
    assert.ok(initial.surfaces >= 5);
    assert.equal(initial.contexts, 1);
    // A real checker image in the existing wallpaper element, with no shader stand-in.
    const checker = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 400;
      const context = canvas.getContext("2d");
      for (let y = 0; y < 400; y += 10)
        for (let x = 0; x < 640; x += 10) {
          context.fillStyle = ((x + y) / 10) % 2 ? "#29513a" : "#f6edca";
          context.fillRect(x, y, 10, 10);
        }
      return canvas.toDataURL("image/png");
    });
    const mainImage = page
      .locator(".new-tab-dashboard .dashboard-wallpaper > img")
      .first();
    await mainImage.evaluate(async (node, src) => {
      node.src = src;
      await node.decode();
    }, checker);
    await page
      .getByRole("button", { name: "Customize dashboard", exact: true })
      .click();
    const editor = page.getByRole("dialog", {
      name: "Customize dashboard",
      exact: true,
    });
    const quality = editor.getByRole("combobox", {
      name: "Render quality",
      exact: true,
    });
    await quality.selectOption("high");
    const image = editor
      .locator(".dashboard-preview .dashboard-wallpaper > img")
      .first();
    await image.evaluate(async (node, src) => {
      node.src = src;
      await node.decode();
    }, checker);
    const sample = editor.locator(".glass-preview-sample");
    await expect(sample).toHaveAttribute("data-liquid-backend", "webgl2");
    const slider = (name) => editor.getByRole("slider", { name, exact: true });
    for (const name of [
      "Blur intensity",
      "Reflection intensity",
      "Border intensity",
      "Surface elasticity",
    ]) {
      await slider(name).focus();
      await slider(name).press("Home");
    }
    await editor
      .getByRole("checkbox", { name: "Hover motion", exact: true })
      .uncheck();
    await page.mouse.move(1, 1);
    await slider("Refraction intensity").focus();
    await slider("Refraction intensity").press("Home");
    const off = await stableLiquidPixels(sample);
    await slider("Refraction intensity").press("End");
    const on = await stableLiquidPixels(sample);
    assert.notEqual(
      off.hash,
      on.hash,
      "Curvature lensing must change real rendered wallpaper pixels",
    );
    const repeated = await stableLiquidPixels(sample);
    assert.equal(
      on.hash,
      repeated.hash,
      "Paused/static optical material must be deterministic",
    );
    assert.ok(
      on.visible > on.width * on.height * 0.75,
      "Shader output must contain actually rendered pixels",
    );
    await sample.screenshot({ path: `${evidence}-image-lens.png` });
    const tokenPixels = {};
    for (const name of [
      "Edge lensing",
      "Glass curvature",
      "Glass saturation",
      "Blur intensity",
    ]) {
      await slider(name).focus();
      await slider(name).press("Home");
      const low = await stableLiquidPixels(sample);
      await slider(name).press("End");
      const high = await stableLiquidPixels(sample);
      assert.notEqual(
        low.hash,
        high.hash,
        `${name} must reach actual sampling/normal/filter uniforms`,
      );
      tokenPixels[name] = { low: low.hash, high: high.hash };
      if (name === "Blur intensity") await slider(name).press("Home");
    }
    const tintInput = editor.getByLabel("Glass tint", { exact: true });
    const tintBefore = await stableLiquidPixels(sample);
    await tintInput.evaluate((input) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set.call(input, "#d0aebb");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const tintAfter = await stableLiquidPixels(sample);
    assert.notEqual(
      tintBefore.hash,
      tintAfter.hash,
      "Manual tint must affect shader pixels even with adaptive tint enabled",
    );
    await slider("Reflection intensity").focus();
    await slider("Reflection intensity").press("End");
    await slider("Specular intensity").focus();
    await slider("Specular intensity").press("Home");
    const noSpec = await stableLiquidPixels(sample);
    await slider("Specular intensity").press("End");
    const spec = await stableLiquidPixels(sample);
    assert.notEqual(
      noSpec.hash,
      spec.hash,
      "Specular control must change pixels",
    );
    await editor
      .getByRole("checkbox", { name: "Hover motion", exact: true })
      .check();
    await page.mouse.move(1, 1);
    const lightStill = await stableLiquidPixels(sample);
    const lightBox = await sample.boundingBox();
    await page.mouse.move(
      lightBox.x + lightBox.width * 0.9,
      lightBox.y + lightBox.height * 0.2,
    );
    await expect
      .poll(async () => Math.abs((await liquidPixels(sample)).deformation[0]))
      .toBeGreaterThan(0.05);
    const lightMoved = await stableLiquidPixels(sample);
    assert.notEqual(
      lightStill.hash,
      lightMoved.hash,
      "Pointer lighting must move with elasticity zero (not just deform an image)",
    );
    await page.mouse.move(1, 1);
    await slider("Surface elasticity").focus();
    await slider("Surface elasticity").press("End");
    await page.mouse.move(1, 1);
    await stableLiquidPixels(sample);
    // The sample is deliberately pointer-events:none. Press the actual
    // containing panel material; its logical controls/hit rectangle stay put.
    const interactionSurface = editor.locator(":scope > .glass-backing");
    const box = await editor.boundingBox();
    const sampleBox = await sample.boundingBox();
    await page.mouse.move(
      sampleBox.x + sampleBox.width * 0.8,
      sampleBox.y + sampleBox.height * 0.55,
    );
    await page.mouse.down();
    await expect
      .poll(
        async () => (await liquidPixels(interactionSurface)).deformation[2],
        { timeout: 15000 },
      )
      .toBeGreaterThan(0.1);
    const pressed = await liquidPixels(interactionSurface);
    assert.deepEqual(
      await editor.boundingBox(),
      box,
      "Elastic material pixels must not deform the actual hit box",
    );
    await page.mouse.up();
    await page.mouse.move(1, 1);
    await expect
      .poll(
        async () =>
          (await liquidPixels(interactionSurface)).deformation.every(
            (value) => Math.abs(value) < 0.001,
          ),
        { timeout: 15000 },
      )
      .toBe(true);
    const released = await stableLiquidPixels(interactionSurface);
    assert.notEqual(
      pressed.hash,
      released.hash,
      "Press/release must visibly deform/recover",
    );
    const idleStart = await liquidMetrics(page);
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 400)),
    );
    const idleEnd = await liquidMetrics(page);
    assert.equal(
      idleStart.draws,
      idleEnd.draws,
      "Static settled materials must stop rendering",
    );
    await quality.selectOption("balanced");
    await expect
      .poll(async () => (await liquidMetrics(page)).quality)
      .toBe("balanced");
    const balanced = await liquidMetrics(page);
    await quality.selectOption("experimental");
    await expect
      .poll(async () => (await liquidMetrics(page)).quality)
      .toBe("experimental");
    const experimental = await liquidMetrics(page);
    assert.equal(experimental.blurSamples, 13);
    assert.ok(experimental.atlasWidth * experimental.atlasHeight <= 8388608);
    await quality.selectOption("performance");
    await expect(page.locator("html")).toHaveAttribute(
      "data-liquid-reason",
      "performance-quality",
    );
    await expect(sample).toHaveAttribute("data-liquid-backend", "css");
    await quality.selectOption("high");
    await expect(sample).toHaveAttribute("data-liquid-backend", "webgl2");
    await page.setViewportSize({ width: 1000, height: 760 });
    await expect
      .poll(async () => (await liquidMetrics(page)).atlasWidth)
      .toBeGreaterThan(0);
    await page.setViewportSize({ width: 1280, height: 840 });
    await editor
      .getByRole("button", { name: "Cancel dashboard changes", exact: true })
      .click();
    await expect(page.locator(".modal-backdrop")).toHaveCount(0);
    // A toolbar object expands into the menu material. Logical keyboard targets stay normal.
    await page.evaluate(() => {
      window.__liquidMorphBoxes = [];
      window.__liquidMorphObserver = new MutationObserver(() => {
        const proxy = document.querySelector(
          'canvas[data-liquid-proxy][data-liquid-morph-target="menu-Lunar"]',
        );
        if (!proxy || window.__liquidMorphBoxes.length >= 120) return;
        const rect = proxy.getBoundingClientRect();
        if (rect.width > 0)
          window.__liquidMorphBoxes.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          });
      });
      window.__liquidMorphObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style"],
      });
    });
    await page.locator('[data-top-menu="Lunar"]').click();
    await expect
      .poll(() => page.evaluate(() => window.__liquidMorphBoxes.length))
      .toBeGreaterThan(0);
    await expect(
      page.locator(
        'canvas[data-liquid-proxy][data-liquid-morph-target="menu-Lunar"]',
      ),
    ).toHaveCount(0, {
      timeout: 15000,
    });
    const morphBoxes = await page.evaluate(() => {
      window.__liquidMorphObserver.disconnect();
      return window.__liquidMorphBoxes;
    });
    fs.writeFileSync(
      `${evidence}-morph.json`,
      JSON.stringify(morphBoxes, null, 2),
    );
    assert.ok(
      Math.max(...morphBoxes.map((r) => r.width)) -
        Math.min(...morphBoxes.map((r) => r.width)) >
        10,
      "The actual material proxy must expand from the toolbar, not just fade",
    );
    const proxyStart = morphBoxes[0];
    const menu = page.getByRole("menu", { name: "Lunar menu", exact: true });
    await menu.press("End");
    await expect(
      menu.getByRole("menuitem", { name: "Settings…", exact: true }),
    ).toBeFocused();
    await menu.press("Escape");
    await expect(page.locator(".lunar-dropdown")).toHaveCount(0);
    const recoverySurface = page.locator(
      '[data-widget-id="notes"] > .glass-surface',
    );
    await expect(recoverySurface).toHaveAttribute(
      "data-liquid-backend",
      "webgl2",
    );
    // Lose the actual renderer context, verify usable CSS, and restore its real resources.
    await page.locator("canvas[data-liquid-renderer]").evaluate((canvas) => {
      const gl = canvas.getContext("webgl2");
      const extension = gl.getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("Context loss extension unavailable");
      canvas.__liquidLoss = extension;
      extension.loseContext();
    });
    await expect(page.locator("html")).toHaveAttribute(
      "data-liquid-reason",
      "context-lost",
    );
    await expect(recoverySurface).toHaveAttribute("data-liquid-backend", "css");
    await page
      .locator("canvas[data-liquid-renderer]")
      .evaluate((canvas) => canvas.__liquidLoss.restoreContext());
    await expect(recoverySurface).toHaveAttribute(
      "data-liquid-backend",
      "webgl2",
      {
        timeout: 20000,
      },
    );
    const recoveredPixels = await stableLiquidPixels(recoverySurface);
    assert.ok(
      recoveredPixels.visible >
        recoveredPixels.width * recoveredPixels.height * 0.75,
      "Context recovery must reupload and paint actual pixels",
    );
    const results = {
      image: { off, on, repeated },
      tokenPixels,
      specular: { off: noSpec.hash, on: spec.hash },
      deformation: { pressed, released, stationaryHitBox: true },
      idle: { before: idleStart.draws, after: idleEnd.draws },
      initial,
      balanced,
      experimental,
      manualTint: { before: tintBefore.hash, after: tintAfter.hash },
      movingSpecular: {
        still: lightStill.hash,
        moved: lightMoved.hash,
        elasticity: 0,
      },
      contextRestored: true,
      recoveredPixels,
      morphProxyStart: proxyStart,
      morphBoxes,
      final: await liquidMetrics(page),
    };
    fs.writeFileSync(
      `${evidence}-metrics.json`,
      JSON.stringify(results, null, 2) + "\n",
    );
    await page.screenshot({ path: `${evidence}-dashboard.png` });
    assert.deepEqual(
      failures,
      [],
      "No renderer errors in actual Liquid Engine checks",
    );
  } finally {
    await page.close();
  }
}

/** Actual native Electron: existing decoded profile-owned video + OS window captures. */
export async function checkNativeLiquidVideo(
  ui,
  api,
  video,
  material,
  capture,
  format,
  evidence,
) {
  const saved = (await api("getDashboard")).glass;
  const probe = {
    ...saved,
    performance: "optical",
    blur: 0,
    refraction: 0,
    reflection: 0,
    border: 0,
    hoverMotion: false,
    liquid: {
      ...saved.liquid,
      quality: "balanced",
      edgeLensing: 0.9,
      curvature: 0.8,
    },
  };
  try {
    await api("updateDashboard", { glass: probe });
    await expect(material).toHaveAttribute("data-liquid-backend", "webgl2", {
      timeout: 20000,
    });
    await video.evaluate(async (node) => {
      node.muted = true;
      await node.play();
    });
    const first = await liquidMetrics(ui),
      firstPixels = await liquidPixels(material);
    await expect
      .poll(
        async () => {
          const metrics = await liquidMetrics(ui),
            pixels = await liquidPixels(material);
          return (
            metrics.source === "video" &&
            metrics.textureUploads > first.textureUploads &&
            metrics.videoPresentedFrames > first.videoPresentedFrames &&
            pixels.width === firstPixels.width &&
            pixels.height === firstPixels.height &&
            pixels.hash !== firstPixels.hash
          );
        },
        { timeout: 20000, intervals: [150, 250, 350] },
      )
      .toBe(true);
    const playing = await liquidMetrics(ui);
    await video.evaluate(
      (node) =>
        new Promise((resolve) => {
          node.pause();
          node.addEventListener(
            "seeked",
            () => requestAnimationFrame(() => requestAnimationFrame(resolve)),
            { once: true },
          );
          node.currentTime = 0.62;
        }),
    );
    await stableLiquidPixels(material);
    const paused = await liquidMetrics(ui);
    const off = await capture();
    await api("updateDashboard", { glass: { ...probe, refraction: 1 } });
    const pixelsOn = await stableLiquidPixels(material);
    const on = await capture(),
      repeated = await capture();
    assert.notEqual(
      off.hash,
      on.hash,
      `${format}: actual native window pixels must be refracted by the WebGL wallpaper texture`,
    );
    assert.equal(
      on.hash,
      repeated.hash,
      `${format}: paused fixed WebGL optics must be stable`,
    );
    const after = await liquidMetrics(ui);
    assert.equal(
      after.textureUploads,
      paused.textureUploads,
      "Changing material uniforms over a paused frame must not upload its texture again",
    );
    assert.equal(after.contexts, 1);
    assert.ok(after.surfaces >= 5);
    assert.ok(pixelsOn.visible > 0);
    assert.equal(
      await ui.locator(".new-tab-dashboard video").count(),
      1,
      "The shared renderer must reuse the existing wallpaper video",
    );
    await ui.screenshot({ path: `${evidence}-liquid-${format}.png` });
    const result = {
      format,
      playing,
      paused: after,
      off,
      on,
      stable: on.hash === repeated.hash,
      oneExistingVideo: true,
    };
    fs.writeFileSync(
      `${evidence}-liquid-${format}.json`,
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(
      `::notice title=Native Liquid Engine ${format}::${JSON.stringify(result)}`,
    );
    return result;
  } finally {
    await api("updateDashboard", { glass: saved });
  }
}

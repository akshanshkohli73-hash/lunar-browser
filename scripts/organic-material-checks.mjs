// Production-renderer assertions. Never packaged or imported by application code.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { expect } from "@playwright/test";
export async function checkOrganicMaterial(page, editor, evidence) {
  await page.emulateMedia({
    reducedMotion: "no-preference",
    forcedColors: "none",
  });
  const global = (name) => editor.getByRole("slider", { name, exact: true });
  await editor
    .getByRole("button", { name: "Coquette meadow", exact: true })
    .click();
  await editor
    .getByRole("combobox", { name: "Dashboard text", exact: true })
    .selectOption("theme");
  await editor
    .getByRole("combobox", { name: "Glass rendering mode", exact: true })
    .selectOption("optical");
  const sample = editor.locator(".glass-preview-sample");
  for (const name of [
    "Glass opacity",
    "Blur intensity",
    "Reflection intensity",
  ]) {
    await global(name).focus();
    await global(name).press("Home");
  }
  const image = editor
    .locator(".dashboard-preview .dashboard-wallpaper > img")
    .first();
  // A renderer-only checker fixture in the actual existing wallpaper element.
  // Native tests separately import profile-owned image and video files.
  await image.evaluate(async (node) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    const context = canvas.getContext("2d");
    for (let y = 0; y < 200; y += 8)
      for (let x = 0; x < 320; x += 8) {
        context.fillStyle = ((x + y) / 8) % 2 ? "#244e37" : "#faf5dc";
        context.fillRect(x, y, 8, 8);
      }
    node.src = canvas.toDataURL("image/png");
    await node.decode();
  });
  await page.mouse.move(2, 2);
  await expect(sample).toHaveAttribute("data-glass-backend", "css-backdrop");
  await expect(sample).toHaveAttribute("data-material-variant", "pearl-css");
  await expect(global("Refraction intensity")).toBeDisabled();
  await expect(
    page.locator("filter, feTurbulence, feDisplacementMap"),
  ).toHaveCount(0);
  const plain = await sample.screenshot({
    path: `${evidence}-pearl-matte.png`,
    animations: "disabled",
  });
  await global("Reflection intensity").focus();
  await global("Reflection intensity").press("End");
  await expect(sample).toHaveAttribute("data-material-variant", "pearl-css");
  assert.doesNotMatch(
    await sample.evaluate((node) => getComputedStyle(node).backdropFilter),
    /url\(/u,
  );
  await page.mouse.move(2, 2);
  const optical = await sample.screenshot({
    path: `${evidence}-pearl-reflection.png`,
    animations: "disabled",
  });
  const stable = await sample.screenshot({ animations: "disabled" });
  assert.equal(
    optical.equals(stable),
    true,
    "Pearl reflections must be static and deterministic, not an animated noise/render loop",
  );
  assert.equal(
    plain.equals(optical),
    false,
    "Changing CSS reflection must change actually painted material pixels, without distorting the backdrop or content",
  );
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const observed = {
    backend: await sample.getAttribute("data-glass-backend"),
    offSha256: sha(plain),
    onSha256: sha(optical),
    stable: optical.equals(stable),
    webglRequired: false,
    material: "pearl-css",
    physicallyRefractive: false,
  };
  fs.writeFileSync(
    `${evidence}-pearl.json`,
    JSON.stringify(observed, null, 2) + "\n",
  );
  // Every added numeric token reaches real rendering, not only persisted JSON.
  await global("Glass saturation").focus();
  await global("Glass saturation").press("Home");
  const saturationLow = await sample.evaluate((node) =>
    Number(node.style.getPropertyValue("--glass-saturation")),
  );
  await global("Glass saturation").press("End");
  assert.ok(
    (await sample.evaluate((node) =>
      Number(node.style.getPropertyValue("--glass-saturation")),
    )) > saturationLow,
  );
  await global("Glass elevation").focus();
  await global("Glass elevation").press("Home");
  await expect(sample).toHaveCSS("--glass-elevation", "0px");
  await global("Glass elevation").press("End");
  assert.ok(
    (await sample.evaluate((node) =>
      parseFloat(node.style.getPropertyValue("--glass-elevation")),
    )) > 0,
  );
  await global("Animation speed").focus();
  await global("Animation speed").press("Home");
  await expect(page.locator("html")).toHaveCSS("--organic-duration", "360ms");
  await editor
    .getByRole("checkbox", { name: "Hover motion", exact: true })
    .uncheck();
  await expect(page.locator("html")).toHaveAttribute(
    "data-glass-hover-motion",
    "false",
  );
  await editor
    .getByRole("checkbox", { name: "Reduced material motion", exact: true })
    .check();
  await expect(page.locator("html")).toHaveAttribute(
    "data-glass-pointer",
    "false",
  );
  await expect(sample).toHaveAttribute("data-glass-backend", "css-backdrop");
  await expect(global("Refraction intensity")).toBeDisabled();
  // Restore the original material before subsequent density / responsive checks.
  await editor
    .getByRole("button", { name: "Reset glass defaults", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await editor
    .getByRole("button", { name: "Midnight garden", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-material-tone",
    "dark",
  );
  await editor
    .getByRole("region", { name: "Dashboard customization options" })
    .evaluate((node) => (node.scrollTop = 0));
  const menuInk = await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Lunar", exact: true })
    .evaluate((node) => {
      const reference = document.createElement("span");
      reference.style.color = getComputedStyle(
        document.documentElement,
      ).getPropertyValue("--organic-ink");
      return {
        actual: getComputedStyle(node).color,
        expected: reference.style.color,
      };
    });
  assert.equal(
    menuInk.actual,
    menuInk.expected,
    "Retained shell selectors must not override dark material ink in the menu bar",
  );
  await page.screenshot({ path: `${evidence}-studio-dark.png` });
  await editor
    .getByRole("button", { name: "Coquette meadow", exact: true })
    .click();
  // Existing baseline assertions run with CSS-balanced effects at this point.
  await editor
    .getByRole("combobox", { name: "Glass rendering mode", exact: true })
    .selectOption("balanced");
}

export async function checkUnsupportedOptics(browser, url, evidence) {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 780 },
  });
  try {
    await page.addInitScript(() => {
      // Renderer has no WebGL context; the CSS fallback must still be functional.
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return String(type).includes("webgl")
          ? null
          : getContext.call(this, type, ...args);
      };
    });
    await page.goto(url);
    const notes = page.locator('[data-widget-id="notes"] > .glass-surface');
    await expect(notes).toHaveAttribute("data-glass-backend", "css-backdrop");
    await expect(notes).toHaveCSS(
      "backdrop-filter",
      "blur(5px) saturate(1.12)",
    );
    await expect(page.locator("feDisplacementMap")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Customize dashboard", exact: true })
      .click();
    await expect(
      page.getByRole("slider", { name: "Refraction intensity", exact: true }),
    ).toBeDisabled();
    await page.screenshot({ path: `${evidence}-unsupported-fallback.png` });
    await page
      .getByRole("button", { name: "Cancel dashboard changes", exact: true })
      .click();
    await expect(notes).toBeVisible();
    await page
      .getByRole("textbox", { name: "Dashboard note" })
      .fill("The CSS fallback remains editable.");
    await expect(
      page.getByRole("textbox", { name: "Dashboard note" }),
    ).toHaveValue("The CSS fallback remains editable.");
    await page
      .getByRole("navigation", { name: "Dock" })
      .getByRole("button", { name: "Appearance", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Your own touch", exact: true })
      .click();
    const chrome = page.locator(".browser-toolbar > .glass-backing");
    const blur = page.getByRole("slider", { name: "Glass blur", exact: true });
    await blur.focus();
    await blur.press("Home");
    await expect(chrome).toHaveCSS(
      "backdrop-filter",
      "blur(0px) saturate(1.22)",
    );
    await blur.press("End");
    await expect(chrome).toHaveCSS(
      "backdrop-filter",
      "blur(6px) saturate(1.22)",
    );
    await page.locator(".browser-tabs").evaluate((node) => {
      const probe = document.createElement("div");
      probe.className = "browser-tab legacy-shape-probe";
      node.append(probe);
    });
    await page
      .getByRole("combobox", { name: "Tab shape", exact: true })
      .selectOption("pill");
    await expect(page.locator(".legacy-shape-probe")).toHaveCSS(
      "border-top-left-radius",
      "20px",
    );
    await page
      .getByRole("combobox", { name: "Tab shape", exact: true })
      .selectOption("minimal");
    await expect(page.locator(".legacy-shape-probe")).toHaveCSS(
      "border-top-left-radius",
      "3px",
    );
    await page.locator(".legacy-shape-probe").evaluate((node) => node.remove());
    const radius = page.getByRole("slider", {
      name: "Corner radius",
      exact: true,
    });
    await radius.focus();
    await radius.press("Home");
    await expect(page.locator(".theme-controls.glass-panel")).toHaveCSS(
      "border-top-left-radius",
      "0px",
    );
  } finally {
    await page.close();
  }
}

// Real layout assertions shared by Chromium and actual Electron; never imported by the app.
import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function checkCustomizationLayout(page, editor, evidence) {
  const options = editor.getByRole("region", {
    name: "Dashboard customization options",
  });
  const actions = editor.getByRole("group", { name: "Dashboard actions" });
  await expect(options).toBeVisible();
  await expect(actions).toBeVisible();
  // Modal entry is intentionally animated now. Measure fixed actions only
  // after the actual dialog geometry settles; retain the strict scroll checks.
  const dialog = await editor.elementHandle();
  await dialog.waitForElementState("stable");
  const original = await actions.boundingBox();
  assert.ok(original);
  for (const progress of [0, 0.5, 1]) {
    await options.evaluate((node, fraction) => {
      node.scrollTop = (node.scrollHeight - node.clientHeight) * fraction;
    }, progress);
    const geometry = await editor.evaluate((node) => {
      const rect = (element) => {
        const r = element.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      const scroll = node.querySelector(".dashboard-studio-scroll");
      const footer = node.querySelector(".dashboard-apply");
      return {
        dialog: rect(node),
        header: rect(node.querySelector(":scope > header")),
        options: rect(scroll),
        footer: rect(footer),
        scrollTop: scroll.scrollTop,
        overflow: scroll.scrollHeight > scroll.clientHeight,
        horizontalOverflow: scroll.scrollWidth > scroll.clientWidth + 1,
        height: innerHeight,
        width: innerWidth,
        hitTargets: [...footer.querySelectorAll("button")].every((button) => {
          const r = button.getBoundingClientRect();
          return (
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) ===
            button
          );
        }),
      };
    });
    assert.ok(
      geometry.overflow,
      "Options must have an independent scroll range",
    );
    assert.equal(
      geometry.horizontalOverflow,
      false,
      "No clipped horizontal options",
    );
    assert.ok(
      geometry.header.top >= 0 && geometry.dialog.bottom <= geometry.height,
    );
    assert.ok(
      geometry.options.top >= geometry.header.bottom - 1,
      "Options must start below the fixed header",
    );
    assert.ok(
      geometry.options.bottom <= geometry.footer.top + 1,
      "Options must end above the action footer",
    );
    assert.ok(
      geometry.footer.bottom <= geometry.dialog.bottom &&
        geometry.footer.bottom <= geometry.height,
    );
    assert.ok(
      Math.abs(geometry.footer.top - original.y) < 1,
      "Actions must not move with the options scroller",
    );
    assert.equal(
      geometry.hitTargets,
      true,
      "No content may cover the action buttons",
    );
    if (progress > 0) assert.ok(geometry.scrollTop > 0);
    if (evidence && progress !== 0.5)
      await page.screenshot({
        path: `${evidence}-${progress ? "bottom" : "top"}.png`,
      });
  }
  await options
    .getByRole("checkbox", { name: "Dock magnification", exact: true })
    .focus();
  await expect(
    options.getByRole("checkbox", { name: "Dock magnification", exact: true }),
  ).toBeInViewport();
  await options.evaluate((node) => {
    node.scrollTop = 0;
  });
}

export async function checkDashboardScroll(page) {
  const scene = page.getByRole("region", { name: "New tab dashboard" });
  const wallpaper = scene.locator(".dashboard-wallpaper");
  const scroll = scene.locator(".dashboard-body");
  const before = await wallpaper.boundingBox();
  assert.ok(before);
  await scroll.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  const after = await wallpaper.boundingBox();
  assert.deepEqual(
    after,
    before,
    "Wallpaper must stay behind the viewport while widgets scroll",
  );
  const footer = await scene.locator(".dashboard-footer").boundingBox();
  const dock = await page
    .getByRole("navigation", { name: "Dock" })
    .boundingBox();
  assert.ok(footer && dock);
  assert.ok(
    footer.y + footer.height + 16 <= dock.y,
    "Last dashboard content needs safe space above the fixed dock",
  );
  await scroll.evaluate((node) => {
    node.scrollTop = 0;
  });
}

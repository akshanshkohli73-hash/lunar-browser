// Browser-test helpers only. Never imported by, or packaged with, the app.
import assert from "node:assert/strict";
import fs from "node:fs";
import { expect } from "@playwright/test";

/** Wait for inputs, media, layout and finite scene motion, not for matching pixels.
 * Do not disable animations: that would conceal an accidental infinite CSS loop.
 * Pixel equality remains an independent, non-retrying assertion in the caller. */
export async function waitForPearlPreview(
  sample,
  reflection,
  { timeout = 5000 } = {},
) {
  await expect(sample).toHaveCSS("--glass-reflection", String(reflection), {
    timeout,
  });
  await sample.scrollIntoViewIfNeeded({ timeout });
  await expect
    .poll(
      () =>
        sample.evaluate(async (node) => {
          // Observe the browser's rendering timeline, not only Node's polling
          // clock; a headless compositor may otherwise defer a pending entry.
          if (document.visibilityState === "visible")
            await new Promise((resolve) => requestAnimationFrame(resolve));
          const scene = node.closest(".dashboard-preview");
          if (!scene) throw new Error("Missing Pearl wallpaper preview");
          const relevant = new Set(scene.getAnimations({ subtree: true }));
          for (
            let ancestor = scene.parentElement;
            ancestor;
            ancestor = ancestor.parentElement
          )
            for (const animation of ancestor.getAnimations())
              relevant.add(animation);
          const animations = [...relevant].filter(
            (animation) =>
              animation.pending || animation.playState === "running",
          );
          return {
            visibility: document.visibilityState,
            fonts: document.fonts.status,
            imagesDecoded: [...scene.querySelectorAll("img")].every(
              (image) => image.complete && image.naturalWidth > 0,
            ),
            outgoingImages: scene.querySelectorAll(".wallpaper-outgoing")
              .length,
            animations: animations.map((animation) => ({
              target: animation.effect?.target?.className ?? "pseudo-element",
              state: animation.playState,
              pending: animation.pending,
              currentTime: String(animation.currentTime),
              playbackRate: animation.playbackRate,
              endTime: String(animation.effect?.getComputedTiming().endTime),
            })),
          };
        }),
      {
        message: "Pearl preview inputs and finite scene motion must settle",
        timeout,
      },
    )
    .toEqual({
      visibility: "visible",
      fonts: "loaded",
      imagesDecoded: true,
      outgoingImages: 0,
      animations: [],
    });
  const element = await sample.elementHandle();
  assert.ok(element, "Pearl preview must remain mounted while settling");
  await element.waitForElementState("stable", { timeout });
  // Cross a paint boundary after scrolling/style adoption. No arbitrary sleep,
  // screenshot retry, animation cancellation or pixel-difference tolerance.
  await sample.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

/** Exercise the readiness guard against actual browser animations, independently
 * of the application pixel comparison (which must never retry until it passes). */
export async function checkPearlCaptureReadiness(browser, url, evidence) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 840 },
    reducedMotion: "no-preference",
  });
  try {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind === "webgl2" ? null : original.call(this, kind, ...args);
      };
    });
    await page.goto(url);
    // The main smoke-test page remains open. Keep this animation regression in
    // the foreground so background-tab timeline throttling cannot freeze it.
    await page.bringToFront();
    await expect
      .poll(() => page.evaluate(() => document.visibilityState))
      .toBe("visible");
    await page
      .getByRole("button", { name: "Customize dashboard", exact: true })
      .click();
    const editor = page.getByRole("dialog", {
      name: "Customize dashboard",
      exact: true,
    });
    const sample = editor.locator(".glass-preview-sample");
    const slider = editor.getByRole("slider", {
      name: "Reflection intensity",
      exact: true,
    });
    await slider.focus();
    await slider.press("Home");
    await waitForPearlPreview(sample, 0);
    // A test-owned finite entry on the real preview must finish naturally;
    // readiness must not force-finish it or mistake it for decorative noise.
    const finite = await sample.evaluate((node) => {
      node.__captureAnimation = node.animate(
        [{ opacity: 0.6 }, { opacity: 1 }],
        { duration: 600, fill: "both" },
      );
      return node.__captureAnimation.playState;
    });
    assert.equal(finite, "running");
    await waitForPearlPreview(sample, 0);
    assert.equal(
      await sample.evaluate((node) => node.__captureAnimation.playState),
      "finished",
      "Readiness must await the finite animation, not finish/cancel it",
    );
    await sample.evaluate((node) => {
      node.__captureAnimation.cancel();
      node.__captureAnimation = node.animate(
        [{ opacity: 0.6 }, { opacity: 1 }],
        { duration: 180, iterations: Infinity },
      );
    });
    await assert.rejects(
      () => waitForPearlPreview(sample, 0, { timeout: 300 }),
      /Pearl preview inputs and finite scene motion must settle/u,
      "An infinite paint animation must fail, not be hidden by a screenshot",
    );
    assert.equal(
      await sample.evaluate((node) => node.__captureAnimation.playState),
      "running",
      "The guard must not cancel an offending animation to make pixels match",
    );
    await sample.evaluate((node) => {
      node.__captureAnimation.cancel();
      delete node.__captureAnimation;
    });
    await waitForPearlPreview(sample, 0);
    fs.writeFileSync(
      `${evidence}-capture-readiness.json`,
      JSON.stringify(
        {
          finiteAnimationAwaited: true,
          infiniteAnimationRejected: true,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await page.close();
  }
}

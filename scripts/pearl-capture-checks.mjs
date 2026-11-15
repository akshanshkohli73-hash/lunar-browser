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
  { timeout = 5000, settleTimeout = timeout } = {},
) {
  await expect(sample).toHaveCSS("--glass-reflection", String(reflection), {
    timeout,
  });
  // Scroll without first requiring stable geometry: the motion guard below must
  // be able to diagnose an endless moving animation instead of blocking here.
  await sample.evaluate((node) =>
    node.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    }),
  );
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
          const materialNodes = [
            node,
            ...scene.querySelectorAll(".glass-surface,.glass-backing"),
          ];
          for (
            let ancestor = scene.parentElement;
            ancestor;
            ancestor = ancestor.parentElement
          )
            materialNodes.push(ancestor);
          // Pointer highlights use the shared finite RAF clock, not the Web
          // Animations API. After the caller leaves the preview, their inline
          // presence must retire naturally before a static pixel assertion.
          const pointerLighting = materialNodes
            .filter(
              (node) =>
                Number(
                  node.style.getPropertyValue("--glass-pointer-presence"),
                ) > 0,
            )
            .map((node) => ({
              target: node.className,
              presence: node.style.getPropertyValue("--glass-pointer-presence"),
            }));
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
            pointerLighting,
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
        timeout: settleTimeout,
        // The predicate is already RAF-paced; do not add Node's polling backoff
        // while waiting for the browser's animation timeline to advance.
        intervals: [0],
      },
    )
    .toEqual({
      visibility: "visible",
      fonts: "loaded",
      imagesDecoded: true,
      outgoingImages: 0,
      pointerLighting: [],
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

/** A small browser fixture tests the guard's finite/infinite animation semantics,
 * not application appearance. Real Pearl pixels and controls remain covered by
 * checkOrganicMaterial on the production app, without retries or paint masks. */
export async function checkPearlCaptureReadiness(browser, evidence) {
  const page = await browser.newPage({
    viewport: { width: 400, height: 260 },
    reducedMotion: "no-preference",
  });
  try {
    // Isolate guard semantics from software-GPU backdrop compositing throughput.
    // This fixture never substitutes for the actual app's pixel comparisons.
    await page.setContent(`<!doctype html>
      <title>Pearl capture-readiness guard fixture</title>
      <style>
        .dashboard-preview { position: relative; width: 320px; height: 200px; }
        img { position: absolute; width: 100%; height: 100%; }
        .glass-preview-sample {
          --glass-reflection: 0;
          position: absolute; inset: 16px; padding: 16px;
          background: #bdeae2; border-radius: 14px;
        }
      </style>
      <div class="dashboard-preview">
        <img alt="Decoded PNG readiness fixture">
        <div class="glass-preview-sample">Capture-readiness guard fixture</div>
      </div>`);
    await page.locator("img").evaluate(async (node) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 16;
      const context = canvas.getContext("2d");
      context.fillStyle = "#244e37";
      context.fillRect(0, 0, 16, 16);
      node.src = canvas.toDataURL("image/png");
      await node.decode();
    });
    // The main smoke-test page remains open; this animation fixture must be
    // visible and use the actual rendering timeline, not a background timer.
    await page.bringToFront();
    const sample = page.locator(".glass-preview-sample");
    await waitForPearlPreview(sample, 0);
    const finite = await sample.evaluate((node) => {
      const animation = node.animate([{ opacity: 0.6 }, { opacity: 1 }], {
        duration: 600,
        fill: "both",
      });
      node.__captureAnimation = animation;
      node.__captureForcedFinish = false;
      const finish = animation.finish.bind(animation);
      animation.finish = () => {
        node.__captureForcedFinish = true;
        finish();
      };
      return animation.playState;
    });
    assert.equal(finite, "running");
    await waitForPearlPreview(sample, 0);
    assert.deepEqual(
      await sample.evaluate((node) => ({
        state: node.__captureAnimation.playState,
        forceFinished: node.__captureForcedFinish,
      })),
      { state: "finished", forceFinished: false },
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
      () => waitForPearlPreview(sample, 0, { settleTimeout: 300 }),
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
      delete node.__captureForcedFinish;
    });
    await waitForPearlPreview(sample, 0);
    await sample.evaluate((node) => {
      node.style.setProperty("--glass-pointer-presence", "0.5");
      const end = performance.now() + 150;
      const retire = (now) => {
        if (now < end) requestAnimationFrame(retire);
        else node.style.removeProperty("--glass-pointer-presence");
      };
      requestAnimationFrame(retire);
    });
    await waitForPearlPreview(sample, 0);
    await sample.evaluate((node) =>
      node.style.setProperty("--glass-pointer-presence", "0.5"),
    );
    await assert.rejects(
      () => waitForPearlPreview(sample, 0, { settleTimeout: 300 }),
      /Pearl preview inputs and finite scene motion must settle/u,
      "The guard must reject non-retiring JS pointer lighting as well as an infinite CSS animation",
    );
    await sample.evaluate((node) =>
      node.style.removeProperty("--glass-pointer-presence"),
    );
    await waitForPearlPreview(sample, 0);
    fs.writeFileSync(
      `${evidence}-capture-readiness.json`,
      JSON.stringify(
        {
          scope: "browser fixture for capture-readiness guard semantics",
          finiteAnimationAwaited: true,
          finiteAnimationForceFinished: false,
          infiniteAnimationRejected: true,
          finitePointerLightingAwaited: true,
          nonRetiringPointerLightingRejected: true,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await page.close();
  }
}

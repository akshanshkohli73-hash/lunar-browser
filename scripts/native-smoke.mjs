import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { deflateSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron } from "playwright-core";
import { expect } from "@playwright/test";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Do not trigger Electron's opportunistic binary installer while checking availability.
const modulePath = path.join(repo, "node_modules/electron");
const marker = path.join(modulePath, "path.txt");
const packaged = process.env.LUNAR_PACKAGED_EXECUTABLE;
if (packaged ? !fs.existsSync(packaged) : !fs.existsSync(marker)) {
  const message =
    "BLOCKED: Electron runtime binary is not installed. Run npm run install:electron with binary-download access, then rerun npm run test:native on a desktop (or Xvfb). No native tests were executed.";
  console.error(message);
  if (process.env.GITHUB_ACTIONS === "true")
    console.error(`::error file=scripts/native-smoke.mjs::${message}`);
  process.exitCode = 2;
} else {
  const executable =
    packaged ??
    path.join(modulePath, "dist", fs.readFileSync(marker, "utf8").trim());
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-native-"));
  let adHits = 0,
    slowImages = 0;
  const pendingResponses = new Set();
  const server = http.createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.url?.startsWith("/ad-pixel")) {
      adHits++;
      response.end("pixel");
      return;
    }
    if (request.url === "/pending-image") {
      slowImages++;
      response.writeHead(200, { "Content-Type": "image/png" });
      response.flushHeaders();
      pendingResponses.add(response);
      response.once("close", () => pendingResponses.delete(response));
      return;
    }
    if (request.url === "/slow") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(
        '<!doctype html><title>Controlled slow load</title><h1>Stop fixture</h1><img src="/pending-image" alt="pending">',
      );
      return;
    }
    if (request.url === "/download") {
      response.writeHead(200, {
        "Content-Type": "text/plain",
        "Content-Disposition": 'attachment; filename="lunar-native.txt"',
      });
      response.end("Lunar native download fixture");
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(
      `<!doctype html><title>Fixture ${request.url}</title><h1>Controlled browser fixture</h1><a href="/next">Next page</a><p>Native Chromium renders this document.</p>`,
    );
  });
  await new Promise((resolve) => server.listen(0, "0.0.0.0", resolve));
  const port = server.address().port,
    origin = `http://127.0.0.1:${port}`;
  let electron, ui;
  const launch = async () => {
    electron = await _electron.launch({
      executablePath: executable,
      args: [
        ...(packaged ? ["--lunar-native-test"] : [repo]),
        "--host-resolver-rules=MAP ads.lunar-shield.test 127.0.0.1",
      ],
      env: { ...process.env, LUNAR_TEST_PROFILE: profile },
      timeout: 30000,
    });
    // WebContentsView tabs are also exposed as Playwright pages, and their
    // about:blank target can initialize before the shell. Never choose by order.
    const shellUrl = pathToFileURL(
      packaged
        ? path.join(
            path.dirname(executable),
            "resources/app.asar/dist/renderer/index.html",
          )
        : path.join(repo, "dist/renderer/index.html"),
    ).href;
    const findShell = () =>
      electron.windows().find((page) => page.url() === shellUrl);
    await expect.poll(() => !!findShell(), { timeout: 30000 }).toBe(true);
    ui = findShell();
    assert.ok(
      ui,
      "The test must target the actual shell, not an unprivileged native tab",
    );
    await ui.waitForFunction(() => !!window.lunarAPI);
    await ui.getByRole("main", { name: "Lunar browser workspace" }).waitFor();
    await ui.emulateMedia({ reducedMotion: "no-preference" });
  };
  const api = (method, ...args) =>
    ui.evaluate(async ({ method, args }) => window.lunarAPI[method](...args), {
      method,
      args,
    });
  const waitTab = (id, url) =>
    ui.waitForFunction(
      async ({ id, url }) => {
        const state = await window.lunarAPI.bootstrap();
        const tab = state.tabs.tabs.find((tab) => tab.id === id);
        return tab?.url === url && !tab.isLoading;
      },
      { id, url },
    );
  const native = () =>
    electron.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return window.contentView.children
        .filter(
          (child) =>
            "webContents" in child &&
            child.webContents.id !== window.webContents.id,
        )
        .map((view) => ({
          id: view.webContents.id,
          url: view.webContents.getURL(),
          bounds: view.getBounds(),
          visible: view.getVisible(),
        }));
    });
  const waitNative = async (count) => {
    await expect
      .poll(async () => (await native()).length, { timeout: 10000 })
      .toBe(count);
    return native();
  };
  const checkGeometry = async () => {
    await expect
      .poll(
        async () => {
          const rect = await ui.locator("#page-viewport").evaluate((node) => {
            const r = node.getBoundingClientRect();
            return {
              x: Math.round(r.x),
              y: Math.round(r.y),
              width: Math.round(r.width),
              height: Math.round(r.height),
            };
          });
          const views = await native();
          return (
            views.length === 1 &&
            JSON.stringify(views[0].bounds) === JSON.stringify(rect)
          );
        },
        { timeout: 10000 },
      )
      .toBe(true);
  };
  try {
    await launch();
    await ui
      .getByRole("button", { name: "Start exploring", exact: true })
      .click();
    await ui
      .getByRole("dialog", { name: "Welcome to Lunar" })
      .waitFor({ state: "hidden" });
    assert.equal((await api("bootstrap")).tabs.tabs.length, 1);
    // The initial new tab is the actual mounted dashboard, not a second browser.
    await expect(
      ui.getByRole("region", { name: "New tab dashboard" }),
    ).toBeVisible();
    await waitNative(0);
    const dashboard = await api("getDashboard");
    const crc = (bytes) => {
      let value = 0xffffffff;
      for (const byte of bytes) {
        value ^= byte;
        for (let bit = 0; bit < 8; bit++)
          value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      return (value ^ 0xffffffff) >>> 0;
    };
    const pngChunk = (type, data) => {
      const name = Buffer.from(type),
        size = Buffer.alloc(4),
        checksum = Buffer.alloc(4);
      size.writeUInt32BE(data.length);
      checksum.writeUInt32BE(crc(Buffer.concat([name, data])));
      return Buffer.concat([size, name, data, checksum]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0);
    ihdr.writeUInt32BE(1, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const chosenFile = path.join(profile, "selected-wallpaper.png");
    fs.writeFileSync(
      chosenFile,
      Buffer.concat([
        Buffer.from("89504e470d0a1a0a", "hex"),
        pngChunk("IHDR", ihdr),
        pngChunk("IDAT", deflateSync(Buffer.from([0, 120, 153, 119, 255]))),
        pngChunk("IEND", Buffer.alloc(0)),
      ]),
    );
    const media = await electron.evaluate(
      async ({ dialog, BrowserWindow }, selected) => {
        const old = dialog.showOpenDialog;
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [selected],
        });
        try {
          return await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
            "window.lunarAPI.chooseWallpaper()",
          );
        } finally {
          dialog.showOpenDialog = old;
        }
      },
      chosenFile,
    );
    assert.equal(media.kind, "image");
    assert.ok(!JSON.stringify(media).includes(profile));
    await api("updateDashboard", {
      wallpaper: { ...dashboard.wallpaper, kind: "image", mediaId: media.id },
      note: "Native persistent dashboard note",
    });
    const decodeWallpaper = () =>
      ui
        .locator(".new-tab-dashboard .dashboard-wallpaper img")
        .evaluate(async (image) => {
          await image.decode();
          return image.naturalWidth;
        });
    assert.equal(
      await decodeWallpaper(),
      1,
      "The UI must decode an actual profile-owned image through lunar-media",
    );
    assert.equal(
      await electron.evaluate(({ session }) =>
        session
          .fromPartition("persist:lunar-web")
          .protocol.isProtocolHandled("lunar-media"),
      ),
      false,
      "Websites must not share the UI's private media handler",
    );
    // Real local video probe: transport/decoder/playback evidence, not DOM media mocks.
    for (const format of ["webm", "mp4"]) {
      const clip = path.join(
        repo,
        "tests",
        "fixtures",
        "media",
        `wallpaper.${format}`,
      );
      const selectedVideo = await electron.evaluate(
        async ({ dialog, BrowserWindow }, selected) => {
          const old = dialog.showOpenDialog;
          dialog.showOpenDialog = async () => ({
            canceled: false,
            filePaths: [selected],
          });
          try {
            return await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
              "window.lunarAPI.chooseWallpaper()",
            );
          } finally {
            dialog.showOpenDialog = old;
          }
        },
        clip,
      );
      await api("updateDashboard", {
        wallpaper: {
          ...dashboard.wallpaper,
          kind: "video",
          mediaId: selectedVideo.id,
          loop: true,
        },
      });
      const video = ui.locator(".new-tab-dashboard video");
      await expect(video).toHaveCount(1);
      const play = ui.getByRole("button", {
        name: "Play wallpaper",
        exact: true,
      });
      if (await play.isVisible()) await play.click();
      try {
        await expect
          .poll(
            () =>
              video.evaluate((v) => ({
                ready: v.readyState >= 2,
                width: v.videoWidth,
                advancing: v.currentTime > 0.1,
              })),
            { timeout: 15000 },
          )
          .toEqual({ ready: true, width: 160, advancing: true });
      } catch (error) {
        const state = await video.evaluate((v) => ({
          src: v.currentSrc,
          ready: v.readyState,
          network: v.networkState,
          paused: v.paused,
          muted: v.muted,
          time: v.currentTime,
          error: v.error
            ? { code: v.error.code, message: v.error.message }
            : null,
          visibility: document.visibilityState,
          focused: document.hasFocus(),
          html: getComputedStyle(v).cssText,
        }));
        throw new Error(
          `Actual ${format} wallpaper failed: ${JSON.stringify(state)}; ${String(error)}`,
          { cause: error },
        );
      }
      await expect(video).toBeVisible();
      const box = await video.boundingBox();
      assert.ok(box);
      const capture = () =>
        electron.evaluate(
          async ({ BrowserWindow }, rect) => {
            const image =
              await BrowserWindow.getAllWindows()[0].webContents.capturePage(
                rect,
              );
            return image
              .toBitmap()
              .reduce((hash, byte) => ((hash * 33) ^ byte) >>> 0, 5381);
          },
          {
            x: Math.round(box.x + 4),
            y: Math.round(box.y + 150),
            width: 20,
            height: 60,
          },
        );
      const seek = (time) =>
        video.evaluate(
          (v, time) =>
            new Promise((resolve) => {
              v.pause();
              v.addEventListener(
                "seeked",
                () =>
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                  ),
                { once: true },
              );
              v.currentTime = time;
            }),
          time,
        );
      await seek(0.2);
      const firstFrame = await capture();
      await seek(0.85);
      assert.notEqual(
        await capture(),
        firstFrame,
        `${format}: actual painted background frames must change, not merely report ready metadata`,
      );
      const note = await ui
        .getByRole("textbox", { name: "Dashboard note" })
        .boundingBox();
      assert.ok(note);
      assert.equal(
        await ui.evaluate(
          ({ x, y }) =>
            document.elementFromPoint(x, y)?.getAttribute("aria-label"),
          { x: note.x + 20, y: note.y + 10 },
        ),
        "Dashboard note",
        "The media layer must not capture widget interactions",
      );
    }
    // A recognized container can still be unreadable. The UI must expose a real retry,
    // not claim to be playing after Chromium's decoder rejects it.
    const broken = path.join(profile, "unreadable.mp4");
    fs.writeFileSync(
      broken,
      fs
        .readFileSync(path.join(repo, "tests/fixtures/media/wallpaper.mp4"))
        .subarray(0, 128),
    );
    const invalid = await electron.evaluate(
      async ({ dialog, BrowserWindow }, selected) => {
        const old = dialog.showOpenDialog;
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [selected],
        });
        try {
          return await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
            "window.lunarAPI.chooseWallpaper()",
          );
        } finally {
          dialog.showOpenDialog = old;
        }
      },
      broken,
    );
    await api("updateDashboard", {
      wallpaper: { ...dashboard.wallpaper, kind: "video", mediaId: invalid.id },
    });
    await expect
      .poll(() =>
        ui
          .locator(".new-tab-dashboard video")
          .evaluate((video) => video.error?.code ?? 0),
      )
      .not.toBe(0);
    try {
      await expect
        .poll(() =>
          ui
            .locator(".new-tab-dashboard .wallpaper-playback button")
            .allTextContents(),
        )
        .toContain("Play wallpaper");
    } catch (error) {
      throw new Error(
        `Decoder retry defect: ${JSON.stringify(await ui.locator(".new-tab-dashboard video").evaluate((v) => ({ code: v.error?.code, paused: v.paused, ready: v.readyState })))}; controls=${JSON.stringify(await ui.locator(".new-tab-dashboard .wallpaper-playback button").allTextContents())}`,
        { cause: error },
      );
    }
    await api("updateDashboard", {
      wallpaper: { ...dashboard.wallpaper, kind: "image", mediaId: media.id },
    });
    await ui
      .getByRole("button", { name: "Customize dashboard", exact: true })
      .click();
    let editor = ui.getByRole("dialog", {
      name: "Customize dashboard",
      exact: true,
    });
    await editor
      .getByRole("button", { name: "Rose stationery", exact: true })
      .click();
    assert.equal(
      (await api("getDashboard")).wallpaper.kind,
      "image",
      "Preview is not a profile write",
    );
    await editor
      .getByRole("button", { name: "Cancel dashboard changes", exact: true })
      .click();
    await expect(editor).toBeHidden();
    assert.equal(await decodeWallpaper(), 1);
    await ui
      .getByRole("button", { name: "Customize dashboard", exact: true })
      .click();
    editor = ui.getByRole("dialog", {
      name: "Customize dashboard",
      exact: true,
    });
    await editor
      .getByRole("combobox", { name: "Dock size", exact: true })
      .selectOption("compact");
    await editor
      .getByRole("button", { name: "Apply dashboard", exact: true })
      .click();
    await expect(editor).toBeHidden();
    assert.equal((await api("getDashboard")).dock.size, "compact");
    await ui
      .getByRole("button", { name: "Arrange widgets", exact: true })
      .click();
    await ui
      .getByRole("button", { name: "Move Clock & date down", exact: true })
      .click();
    await ui.getByRole("button", { name: "Save layout", exact: true }).click();
    await expect(
      ui.getByRole("button", { name: "Arrange widgets", exact: true }),
    ).toBeVisible();
    assert.equal(
      (await api("getDashboard")).widgets.find(
        (widget) => widget.kind === "clock",
      ).y,
      1,
    );
    await assert.rejects(
      () =>
        api("getWeather", {
          latitude: 0,
          longitude: 0,
          units: "celsius",
          consent: false,
        }),
      /Invalid request/,
    );

    const a = await api("createTab", `${origin}/first`),
      b = await api("createTab", `${origin}/second`);
    await waitTab(b.id, `${origin}/second`);
    await waitTab(a.id, `${origin}/first`);
    await waitNative(1);
    await checkGeometry();
    const nativeContentId = (await native())[0].id;
    await ui
      .getByRole("navigation", { name: "Browser navigation" })
      .getByRole("button", { name: "Lunar Shield", exact: true })
      .click();
    await expect(
      ui.getByRole("dialog", { name: "Lunar Shield", exact: true }),
    ).toBeVisible();
    await waitNative(0);
    await ui
      .getByRole("button", { name: "Close Lunar Shield", exact: true })
      .click();
    await waitNative(1);
    await checkGeometry();

    await electron.evaluate(
      ({ webContents }, id) => webContents.fromId(id).setZoomFactor(1.25),
      nativeContentId,
    );
    await checkGeometry();
    await electron.evaluate(
      ({ webContents }, id) => webContents.fromId(id).setZoomFactor(1),
      nativeContentId,
    );

    const globals = await electron.evaluate(
      async ({ webContents }, id) =>
        webContents
          .fromId(id)
          .executeJavaScript(
            "({node:typeof require,bridge:typeof window.lunarAPI})",
          ),
      nativeContentId,
    );
    assert.deepEqual(globals, { node: "undefined", bridge: "undefined" });
    await api("navigateTab", a.id, `${origin}/next`);
    await waitTab(a.id, `${origin}/next`);
    await api("goBack", a.id);
    await waitTab(a.id, `${origin}/first`);
    await api("goForward", a.id);
    await waitTab(a.id, `${origin}/next`);
    // An unfinished real image request keeps Chromium loading; no fake timer/state.
    await electron.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.focus();
      window.webContents.focus();
    });
    await ui.getByRole("textbox", { name: "Address and search" }).focus();
    const chromeFocused = () =>
      electron.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.isFocused(),
      );
    await expect.poll(chromeFocused).toBe(true);
    await api("navigateTab", a.id, `${origin}/slow`);
    await expect.poll(() => slowImages).toBe(1);
    const nativeLoading = () =>
      electron.evaluate(
        ({ webContents }, url) =>
          webContents
            .getAllWebContents()
            .find((contents) => contents.getURL() === url)
            ?.isLoading(),
        `${origin}/slow`,
      );
    await expect.poll(nativeLoading).toBe(true);
    await expect.poll(chromeFocused).toBe(true);
    assert.equal(
      (await api("bootstrap")).tabs.tabs.find((tab) => tab.id === b.id)
        .isLoading,
      false,
    );
    await api("stopTab", a.id);
    await expect.poll(nativeLoading).toBe(false);
    await waitTab(a.id, `${origin}/slow`);
    await api("navigateTab", a.id, `${origin}/next`);
    await waitTab(a.id, `${origin}/next`);
    await expect.poll(chromeFocused).toBe(true);
    // Exercise the native before-input-event path, not a DOM-only shortcut.
    await electron.evaluate(({ webContents }, id) => {
      const contents = webContents.fromId(id);
      contents.focus();
      contents.sendInputEvent({
        type: "keyDown",
        keyCode: "L",
        modifiers: ["control"],
      });
      contents.sendInputEvent({
        type: "keyUp",
        keyCode: "L",
        modifiers: ["control"],
      });
    }, nativeContentId);
    await expect(
      ui.getByRole("textbox", { name: "Address and search" }),
    ).toBeFocused();
    await expect.poll(chromeFocused).toBe(true);
    assert.equal(
      (await api("bootstrap")).tabs.tabs.find((tab) => tab.id === b.id).url,
      `${origin}/second`,
    );
    await assert.rejects(
      () => api("navigateTab", b.id, "file:///private/file"),
      /not supported/,
    );
    await assert.rejects(
      () => api("closeTab", "invalid-id"),
      /no longer available/,
    );
    await assert.rejects(
      () => api("updateSettings", { aiApiKey: "not-a-permitted-setting" }),
      /Invalid request/,
    );
    await ui
      .getByRole("navigation", { name: "Dock" })
      .getByRole("button", { name: "Appearance", exact: true })
      .click();
    await ui
      .getByRole("heading", { name: "Theme Studio", exact: true })
      .waitFor();
    await waitNative(0);
    await api("switchTab", b.id);
    await waitNative(1);
    await checkGeometry();
    // Every installed shortcut targets a real internal page, retaining the website tabs.
    for (const [label, page] of [
      ["Home", "newtab"],
      ["Widgets", "widgets"],
      ["Appearance", "themestudio"],
      ["Lunar Shield", "shield"],
      ["Library", "bookmarks"],
      ["Activity", "history"],
      ["Downloads", "downloads"],
      ["Extensions", "extensions"],
      ["Settings", "settings"],
    ]) {
      await ui
        .getByRole("navigation", { name: "Dock" })
        .getByRole("button", { name: label, exact: true })
        .click();
      await expect
        .poll(async () => {
          const snap = await api("bootstrap");
          return snap.tabs.tabs.find((tab) => tab.id === snap.tabs.activeTabId)
            ?.url;
        })
        .toBe(`lunar://${page}`);
      await waitNative(0);
      assert.equal(
        await ui.getByRole("main", { name: "Lunar browser workspace" }).count(),
        1,
      );
    }
    await api("switchTab", b.id);
    await waitNative(1);
    await ui
      .getByRole("menubar")
      .getByRole("menuitem", { name: "View", exact: true })
      .click();
    await waitNative(0);
    await ui
      .getByRole("menu", { name: "View menu" })
      .getByRole("menuitem", { name: "Zoom in", exact: true })
      .click();
    assert.equal(
      await electron.evaluate(
        ({ webContents }, id) =>
          Math.round(webContents.fromId(id).getZoomFactor() * 10) / 10,
        nativeContentId,
      ),
      1.1,
    );
    await api("browserCommand", "zoomReset", "page");
    await waitNative(1);
    await checkGeometry();
    await ui
      .getByRole("menubar")
      .getByRole("menuitem", { name: "Help", exact: true })
      .click();
    await ui
      .getByRole("menu", { name: "Help menu" })
      .getByRole("menuitem", { name: "Diagnostics", exact: true })
      .click();
    await ui
      .getByRole("heading", { name: "Diagnostics", exact: true })
      .waitFor();
    assert.equal((await api("getAppInfo")).packaged, !!packaged);
    await api("switchTab", b.id);
    await waitNative(1);
    await electron.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1100, 720),
    );
    await ui.waitForFunction(() => window.innerWidth === 1100);
    await checkGeometry();
    if (process.platform === "win32") {
      await api("maximize");
      await expect
        .poll(() =>
          electron.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].isMaximized(),
          ),
        )
        .toBe(true);
      await checkGeometry();
      await api("maximize");
      await expect
        .poll(() =>
          electron.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].isMaximized(),
          ),
        )
        .toBe(false);
      await checkGeometry();
    }
    const before = adHits;
    const fetchPixel = () =>
      electron.evaluate(
        async ({ webContents }, { id, url }) =>
          webContents
            .fromId(id)
            .executeJavaScript(
              `fetch(${JSON.stringify(url)},{mode:'no-cors'}).then(()=>'allowed',()=>'blocked')`,
            ),
        {
          id: nativeContentId,
          url: `http://ads.lunar-shield.test:${port}/ad-pixel?t=${Date.now()}`,
        },
      );
    assert.equal(await fetchPixel(), "blocked");
    assert.equal(adHits, before);
    const settings = await api("getSettings");
    await api("updateSettings", {
      shield: { ...settings.shield, enabled: false },
    });
    assert.equal(await fetchPixel(), "allowed");
    assert.equal(adHits, before + 1);
    await api("updateSettings", { shield: settings.shield });
    const fixture = await electron.evaluate(
      async ({ dialog, BrowserWindow }, folder) => {
        const oldOpen = dialog.showOpenDialog,
          oldMessage = dialog.showMessageBox;
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [folder],
        });
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
        try {
          return await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
            "window.lunarAPI.loadUnpackedExtension()",
          );
        } finally {
          dialog.showOpenDialog = oldOpen;
          dialog.showMessageBox = oldMessage;
        }
      },
      path.join(repo, "tests/fixtures/extension"),
    );
    assert.ok(fixture.enabled);
    await api("navigateTab", b.id, `${origin}/extension-check`);
    await waitTab(b.id, `${origin}/extension-check`);
    const fixtureAttribute = () =>
      electron.evaluate(
        async ({ webContents }, id) =>
          webContents
            .fromId(id)
            .executeJavaScript(
              'document.documentElement.getAttribute("data-lunar-extension-fixture")',
            ),
        nativeContentId,
      );
    await expect.poll(fixtureAttribute).toBe("loaded");
    assert.equal(
      await ui.evaluate(() =>
        document.documentElement.getAttribute("data-lunar-extension-fixture"),
      ),
      null,
    );
    await api("toggleExtension", fixture.id, false);
    await api("reloadTab", b.id);
    await waitTab(b.id, `${origin}/extension-check`);
    await expect.poll(fixtureAttribute).toBe(null);
    await api("removeExtension", fixture.id);
    await electron.evaluate(
      async ({ session, webContents }, { origin, id }) => {
        const web = session.fromPartition("persist:lunar-web");
        await web.cookies.set({
          url: origin,
          name: "native_private_cookie",
          value: "never-send-to-renderer",
          httpOnly: true,
        });
        await web.cookies.set({
          url: "http://unrelated.invalid/",
          name: "keep_me",
          value: "other-origin",
        });
        await webContents
          .fromId(id)
          .executeJavaScript(
            "localStorage.setItem('native-site-data', 'fixture')",
          );
      },
      { origin, id: nativeContentId },
    );
    const sitePrivacy = await api("getSitePrivacy", origin);
    assert.ok(sitePrivacy.cookies >= 1);
    assert.ok(!JSON.stringify(sitePrivacy).includes("never-send-to-renderer"));
    await api("denySitePermission", origin, "notifications", true);
    assert.ok(
      (await api("getSitePrivacy", origin)).denials.includes("notifications"),
    );
    await api("resetSitePermissions", origin);
    assert.deepEqual((await api("getSitePrivacy", origin)).grants, []);
    await electron.evaluate(async ({ dialog, BrowserWindow }, origin) => {
      const old = dialog.showMessageBox;
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
      try {
        await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
          `window.lunarAPI.clearOriginData(${JSON.stringify(origin)})`,
        );
      } finally {
        dialog.showMessageBox = old;
      }
    }, origin);
    assert.equal((await api("getSitePrivacy", origin)).cookies, 0);
    await api("reloadTab", b.id);
    await waitTab(b.id, `${origin}/extension-check`);
    assert.equal(
      await electron.evaluate(
        ({ webContents }, id) =>
          webContents
            .fromId(id)
            .executeJavaScript("localStorage.getItem('native-site-data')"),
        nativeContentId,
      ),
      null,
    );
    assert.equal(
      await electron.evaluate(
        async ({ session }) =>
          (
            await session
              .fromPartition("persist:lunar-web")
              .cookies.get({ url: "http://unrelated.invalid/" })
          ).length,
      ),
      1,
      "Clearing one origin must keep unrelated origins",
    );

    const savePath = path.join(profile, "lunar-native.txt");
    const downloadProbe = await electron.evaluateHandle(
      ({ session }, savePath) => {
        const observed = {
          received: false,
          requestedPath: savePath,
          initialPath: "",
          finalPath: "",
          state: "",
        };
        session
          .fromPartition("persist:lunar-web")
          .once("will-download", (_event, item) => {
            observed.received = true;
            item.setSavePath(savePath);
            observed.initialPath = item.getSavePath();
            item.once("done", (_event, state) => {
              observed.finalPath = item.getSavePath();
              observed.state = state;
            });
          });
        return observed;
      },
      savePath,
    );
    await api("navigateTab", b.id, `${origin}/download`);
    await ui.waitForFunction(async () =>
      (await window.lunarAPI.getDownloads()).some(
        (item) => item.status === "completed",
      ),
    );
    const downloadDiagnostic = {
      native: await downloadProbe.jsonValue(),
      records: await api("getDownloads"),
      profileFiles: fs.readdirSync(profile),
    };
    await downloadProbe.dispose();
    await expect
      .poll(() => fs.existsSync(savePath), {
        timeout: 5000,
        message: `The completed native download must reach its chosen destination: ${JSON.stringify(downloadDiagnostic)}`,
      })
      .toBe(true);
    assert.equal(
      fs.readFileSync(savePath, "utf8"),
      "Lunar native download fixture",
    );
    assert.equal(
      (await api("bootstrap")).tabs.tabs.find((tab) => tab.id === b.id).url,
      `${origin}/extension-check`,
    );
    const denied = await electron.evaluate(
      async ({ BrowserWindow }, { preload, url }) => {
        const probe = new BrowserWindow({
          show: false,
          webPreferences: {
            preload,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        });
        try {
          await probe.loadURL(url);
          return await probe.webContents.executeJavaScript(
            'window.lunarAPI.bootstrap().then(()=>"UNAUTHORIZED",error=>error.message)',
          );
        } finally {
          probe.destroy();
        }
      },
      {
        preload: path.join(repo, "dist/electron/preload/index.cjs"),
        url: origin,
      },
    );
    assert.match(denied, /trusted application interface/);
    await api("addBookmark", {
      title: "Native fixture",
      url: `${origin}/first`,
      folder: "Tests",
    });
    await api("updateSettings", {
      restoreSession: true,
      themeId: "pastel-forest",
      isFirstRun: false,
    });
    for (let index = 0; index < 12; index++) {
      const tab = await api("createTab");
      await api("closeTab", tab.id);
    }
    // Exercise the custom Edit menu against a real focused chrome input.
    await api("switchTab", b.id);
    await waitNative(1);
    const addressInput = ui.getByRole("textbox", {
      name: "Address and search",
    });
    await addressInput.fill("before");
    await addressInput.selectText();
    await electron.evaluate(({ clipboard }) =>
      clipboard.writeText("fixture paste"),
    );
    const editMenu = async (label) => {
      await ui
        .getByRole("menubar")
        .getByRole("menuitem", { name: "Edit", exact: true })
        .click();
      await ui
        .getByRole("menu", { name: "Edit menu" })
        .getByRole("menuitem", { name: label, exact: true })
        .click();
    };
    await editMenu("Paste");
    await expect(addressInput).toHaveValue("fixture paste");
    await editMenu("Undo");
    await expect(addressInput).toHaveValue("before");
    await editMenu("Redo");
    await expect(addressInput).toHaveValue("fixture paste");
    await editMenu("Select all");
    await editMenu("Copy");
    assert.equal(
      await electron.evaluate(({ clipboard }) => clipboard.readText()),
      "fixture paste",
    );
    await editMenu("Cut");
    await expect(addressInput).toHaveValue("");
    await editMenu("Paste");
    await expect(addressInput).toHaveValue("fixture paste");
    await ui
      .getByRole("navigation", { name: "Dock" })
      .getByRole("button", { name: "Activity", exact: true })
      .click();
    await expect
      .poll(() => ui.locator(".library-page .library-row").count())
      .toBeGreaterThan(0);
    await ui
      .getByRole("menubar")
      .getByRole("menuitem", { name: "History", exact: true })
      .click();
    await ui
      .getByRole("menu", { name: "History menu" })
      .getByRole("menuitem", { name: "Clear browsing history…", exact: true })
      .click();
    await ui
      .getByRole("dialog", { name: "Clear browsing history" })
      .getByRole("button", { name: "Clear all history", exact: true })
      .click();
    await expect.poll(() => api("getHistory")).toEqual([]);
    await expect(ui.locator(".library-page .library-row")).toHaveCount(0);
    const persistedClip = path.join(profile, "selected-video.mp4");
    fs.copyFileSync(
      path.join(repo, "tests/fixtures/media/wallpaper.mp4"),
      persistedClip,
    );
    await ui
      .getByRole("navigation", { name: "Dock" })
      .getByRole("button", { name: "Appearance", exact: true })
      .click();
    await ui
      .getByRole("button", { name: "Background & dock", exact: true })
      .click();
    const originalDialog = await electron.evaluateHandle(
      ({ dialog }) => dialog.showOpenDialog,
    );
    await electron.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, persistedClip);
    try {
      await ui
        .getByRole("button", {
          name: "Choose local image or video",
          exact: true,
        })
        .click();
      await expect
        .poll(() =>
          ui.locator(".dashboard-preview video").evaluate((v) => v.videoWidth),
        )
        .toBe(160);
    } finally {
      await electron.evaluate(({ dialog }, original) => {
        dialog.showOpenDialog = original;
      }, originalDialog);
      await originalDialog.dispose();
    }
    await ui
      .getByRole("checkbox", {
        name: "Show manual sound controls",
        exact: true,
      })
      .check();
    await ui
      .getByRole("button", { name: "Apply dashboard", exact: true })
      .click();
    await expect(
      ui.getByText("Dashboard saved to this profile.", { exact: true }),
    ).toBeVisible();
    fs.unlinkSync(persistedClip);
    await ui
      .getByRole("navigation", { name: "Dock" })
      .getByRole("button", { name: "Home", exact: true })
      .click();
    await expect
      .poll(() =>
        ui
          .locator(".new-tab-dashboard video")
          .evaluate((v) => !v.paused && v.currentTime > 0.1),
      )
      .toBe(true);
    assert.equal(
      await ui
        .locator(".new-tab-dashboard video")
        .evaluate((v) => v.muted && v.loop),
      true,
    );
    await ui
      .getByRole("button", { name: "Unmute wallpaper", exact: true })
      .click();
    assert.equal(
      await ui.locator(".new-tab-dashboard video").evaluate((v) => v.muted),
      false,
    );
    await ui
      .getByRole("button", { name: "Pause wallpaper", exact: true })
      .click();
    assert.equal(
      await ui.locator(".new-tab-dashboard video").evaluate((v) => v.paused),
      true,
    );
    await ui
      .getByRole("button", { name: "Play wallpaper", exact: true })
      .click();
    await expect
      .poll(() =>
        ui
          .locator(".new-tab-dashboard video")
          .evaluate((v) => !v.paused && v.muted),
      )
      .toBe(true);
    await ui.emulateMedia({ reducedMotion: "reduce" });
    await expect
      .poll(() =>
        ui.locator(".new-tab-dashboard video").evaluate((v) => v.paused),
      )
      .toBe(true);
    await ui
      .getByRole("button", { name: "Play wallpaper", exact: true })
      .click();
    await expect
      .poll(() =>
        ui.locator(".new-tab-dashboard video").evaluate((v) => !v.paused),
      )
      .toBe(true);
    await ui.emulateMedia({ reducedMotion: "no-preference" });
    const saved = await api("bootstrap");
    await expect
      .poll(
        () =>
          electron.evaluate(
            ({ webContents }) => webContents.getAllWebContents().length,
          ),
        { timeout: 10000 },
      )
      .toBe(saved.tabs.tabs.length + 1);
    await electron.close();
    electron = undefined;
    await launch();
    const restored = await api("bootstrap");
    assert.equal(restored.settings.themeId, "pastel-forest");
    assert.deepEqual(
      restored.dashboard,
      saved.dashboard,
      "Dashboard, local media ID, dock and widget layout survive a normal restart",
    );
    // Both restored tabs are websites at this point; open a real new tab to read the persisted dashboard.
    const home = await api("createTab");
    assert.equal(home.url, "lunar://newtab");
    await waitNative(0);
    await expect
      .poll(() =>
        ui
          .locator(".new-tab-dashboard video")
          .evaluate(
            (v) =>
              v.videoWidth === 160 &&
              !v.paused &&
              v.currentTime > 0.1 &&
              v.muted &&
              v.loop,
          ),
      )
      .toBe(true);
    assert.equal(
      (await api("getDashboard")).wallpaper.mediaId,
      saved.dashboard.wallpaper.mediaId,
    );

    assert.ok(
      restored.bookmarks.some(
        (bookmark) => bookmark.title === "Native fixture",
      ),
    );
    assert.deepEqual(
      restored.tabs.tabs.map((tab) => tab.url),
      saved.tabs.tabs.map((tab) => tab.url),
    );
    console.log(
      `PASS: ${packaged ? "Packaged" : "Development"} native Electron on ${process.platform}: isolated Chromium tabs, navigation/loading/stop, background focus and native Ctrl+L, geometry/resize, overlay detachment, real Shield request interception on/off, profile-owned media decoding/scope, dashboard preview/cancel/layout and restart, scoped cookie/storage clearing and permission reset, content zoom geometry, real extension content script/unload, download bytes, sender rejection, malformed IPC, restart/persistence and explicit repeated-close webContents cleanup.`,
    );
    console.log(
      "Installed NSIS launch/upgrade/uninstall, multi-monitor Windows DPI, additional video codecs and OS device consent still need manual verification. Known H.264 MP4 / VP8 WebM decoding, painted frames, seeking, persistence and controls executed above. No signing service is required.",
    );
  } catch (error) {
    // CI log downloads may be inaccessible to API clients; expose the actual
    // failure in the check annotations too, without turning failures into passes.
    if (process.env.GITHUB_ACTIONS === "true") {
      const detail =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
      const escaped = detail
        .replaceAll("%", "%25")
        .replaceAll("\r", "%0D")
        .replaceAll("\n", "%0A");
      console.error(`::error file=scripts/native-smoke.mjs::${escaped}`);
    }
    throw error;
  } finally {
    await electron?.close();
    for (const response of pendingResponses) response.destroy();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { expect } from "@playwright/test";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Do not trigger Electron's opportunistic binary installer while checking availability.
const modulePath = path.join(repo, "node_modules/electron");
const marker = path.join(modulePath, "path.txt");
if (!fs.existsSync(marker)) {
  const message =
    "BLOCKED: Electron runtime binary is not installed. Run npm run install:electron with binary-download access, then rerun npm run test:native on a desktop (or Xvfb). No native tests were executed.";
  console.error(message);
  if (process.env.GITHUB_ACTIONS === "true")
    console.error(`::error file=scripts/native-smoke.mjs::${message}`);
  process.exitCode = 2;
} else {
  const executable = path.join(
    modulePath,
    "dist",
    fs.readFileSync(marker, "utf8").trim(),
  );
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-native-"));
  let adHits = 0;
  const server = http.createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.url?.startsWith("/ad-pixel")) {
      adHits++;
      response.end("pixel");
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
      args: [repo, "--host-resolver-rules=MAP ads.lunar-shield.test 127.0.0.1"],
      env: { ...process.env, LUNAR_TEST_PROFILE: profile },
      timeout: 30000,
    });
    ui = await electron.firstWindow();
    await ui.waitForFunction(() => !!window.lunarAPI);
    await ui.getByRole("main", { name: "Lunar browser workspace" }).waitFor();
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
    const a = await api("createTab", `${origin}/first`),
      b = await api("createTab", `${origin}/second`);
    await waitTab(b.id, `${origin}/second`);
    await waitTab(a.id, `${origin}/first`);
    await waitNative(1);
    await checkGeometry();
    const nativeContentId = (await native())[0].id;
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
      .getByRole("button", { name: "Theme Studio", exact: true })
      .click();
    await ui
      .getByRole("dialog", { name: "Theme Studio", exact: true })
      .waitFor();
    await ui.waitForFunction(
      () => document.querySelector(".native-covered") !== null,
    );
    await waitNative(0);
    await ui
      .getByRole("navigation", { name: "Dock" })
      .getByRole("button", { name: "Lunar Browser", exact: true })
      .click();
    await ui.waitForFunction(
      () => document.querySelector(".native-covered") === null,
    );
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
    const saved = await api("bootstrap");
    await electron.close();
    electron = undefined;
    await launch();
    const restored = await api("bootstrap");
    assert.equal(restored.settings.themeId, "pastel-forest");
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
      `PASS: Native Electron on ${process.platform}: isolated Chromium tabs, navigation, geometry/resize, overlay detachment, real Shield request interception on/off, real extension content script/unload, download bytes, sender rejection, malformed IPC, restart/persistence and repeated close cleanup.`,
    );
    console.log(
      "Manual Windows DPI, maximize/restore, device permissions, installer and signed-release checks are still required.",
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
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

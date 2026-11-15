import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";

/** Real Electron/Chromium requests and the production main/preload/renderer.
 * Dialog choices are automated in the native test process, never in app code.
 * All content is a controlled local fixture; this is NOT a live YouTube test. */
export async function checkNativeShield({
  electron,
  ui,
  api,
  waitTab,
  waitNative,
  profile,
  evidence,
}) {
  const previous = await api("bootstrap"),
    created = [],
    observations = {
      requests: [],
      checks: [],
      liveYoutube: "not-executed-local-fixtures-only",
    };
  const hits = new Map(),
    cookiesSeen = new Map();
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH8kAAAAASUVORK5CYII=",
    "base64",
  );
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://fixture.invalid");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
      "Access-Control-Allow-Origin",
      request.headers.origin || "*",
    );
    response.setHeader("Access-Control-Allow-Credentials", "true");
    if (url.pathname.startsWith("/asset")) {
      hits.set(
        url.searchParams.get("probe"),
        (hits.get(url.searchParams.get("probe")) || 0) + 1,
      );
      cookiesSeen.set(
        url.searchParams.get("probe"),
        request.headers.cookie || "",
      );
      if (url.searchParams.has("setCookie"))
        response.setHeader(
          "Set-Cookie",
          "third_party_response=native-fixture; Path=/; SameSite=Lax",
        );
      if (url.pathname.endsWith(".png")) {
        response.setHeader("Content-Type", "image/png");
        response.end(pixel);
      } else {
        response.setHeader("Content-Type", "text/javascript");
        response.end(
          "window.__shieldNativeAsset = (window.__shieldNativeAsset || 0) + 1;",
        );
      }
      return;
    }
    if (url.pathname === "/redirect") {
      response.writeHead(302, {
        Location: `http://ads.lunar-shield.test:${server.address().port}/asset.js?probe=redirect-final`,
      });
      response.end();
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end(
      '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Shield native fixture</title><h1>Controlled native Shield fixture</h1>',
    );
  });
  await new Promise((resolve) => server.listen(0, "0.0.0.0", resolve));
  const port = server.address().port,
    origin = `http://127.0.0.1:${port}`,
    other = `http://localhost:${port}`;
  const aURL = `${origin}/shield-one`,
    bURL = `${other}/shield-two`;
  const asset = (host, probe, extension = "js") =>
    `http://${host}:${port}/asset.${extension}?probe=${probe}`;
  const native = (url, script) =>
    electron.evaluate(
      async ({ webContents }, { url, script }) => {
        const contents = webContents
          .getAllWebContents()
          .find(
            (contents) => !contents.isDestroyed() && contents.getURL() === url,
          );
        if (!contents)
          throw new Error(`The native fixture tab is missing: ${url}`);
        return contents.executeJavaScript(script, true);
      },
      { url, script },
    );
  const request = async (pageURL, target, kind = "script") => {
    const result = await native(
      pageURL,
      kind === "fetch"
        ? `fetch(${JSON.stringify(target)}, { credentials:'include' }).then(()=>'allowed', ()=>'blocked')`
        : `new Promise(resolve => { const node = document.createElement(${JSON.stringify(kind === "image" ? "img" : "script")}); node.onload=()=>{node.remove();resolve('allowed')};node.onerror=()=>{node.remove();resolve('blocked')};node.src=${JSON.stringify(target)};document.body.append(node); })`,
    );
    observations.requests.push({
      probe:
        new URL(target).searchParams.get("probe") || new URL(target).pathname,
      kind,
      result,
    });
    return result;
  };
  const state = (site = origin) => api("getShieldState", site);
  const confirm = (method, args = [], response = 1) =>
    electron.evaluate(
      async ({ dialog, BrowserWindow }, { method, args, response }) => {
        const old = dialog.showMessageBox;
        dialog.showMessageBox = async () => ({
          response,
          checkboxChecked: false,
        });
        try {
          return await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
            `window.lunarAPI[${JSON.stringify(method)}](...${JSON.stringify(args)})`,
          );
        } finally {
          dialog.showMessageBox = old;
        }
      },
      { method, args, response },
    );
  try {
    const a = await api("createTab", aURL);
    created.push(a.id);
    await waitTab(a.id, aURL);
    const b = await api("createTab", bURL);
    created.push(b.id);
    await waitTab(b.id, bURL);
    await native(aURL, "document.readyState");
    await native(bURL, "document.readyState");
    const initial = (await state()).protection.statistics.periods.all.totals;
    assert.equal(
      await request(aURL, asset("ads.lunar-shield.test", "core-ad")),
      "blocked",
    );
    assert.equal(
      hits.get("core-ad") || 0,
      0,
      "Blocked bytes must never reach the server",
    );
    await expect
      .poll(
        async () =>
          (await state()).protection.statistics.periods.all.totals.blocked,
      )
      .toBe(initial.blocked + 1);
    assert.equal((await state()).protection.site.counters.ads, 1);
    const afterBlock = (await state()).protection.statistics.periods.all.totals;
    assert.equal(
      await request(aURL, asset("cdn.lunar-shield.test", "legitimate")),
      "allowed",
    );
    assert.equal(hits.get("legitimate"), 1);
    await expect
      .poll(
        async () =>
          (await state()).protection.statistics.periods.all.totals.allowed,
      )
      .toBeGreaterThanOrEqual(afterBlock.allowed + 1);
    const beforeRedirect = (await state()).protection.statistics.periods.all
      .totals;
    assert.equal(await request(aURL, `${origin}/redirect`), "blocked");
    await expect
      .poll(
        async () =>
          (await state()).protection.statistics.periods.all.totals.blocked,
      )
      .toBe(beforeRedirect.blocked + 1);
    assert.equal(
      (await state()).protection.statistics.periods.all.totals.evaluated,
      beforeRedirect.evaluated + 1,
      "A redirect chain has one Chromium request identity",
    );
    observations.checks.push(
      "actual cancellation/allow/server delivery, one redirect identity, inactive-tab attribution",
    );

    await api("switchTab", a.id);
    await waitNative(1);
    await ui
      .getByRole("navigation", { name: "Browser navigation" })
      .getByRole("button", { name: "Lunar Shield", exact: true })
      .click();
    const popup = ui.getByRole("dialog", { name: "Lunar Shield", exact: true });
    await expect(popup).toBeVisible();
    await waitNative(0);
    await expect(popup.getByText(origin, { exact: true })).toBeVisible();
    const protect = popup.getByRole("checkbox", {
      name: /Protect this website/,
    });
    await expect(protect).toBeEnabled();
    await protect.click();
    await expect
      .poll(async () => (await state()).protection.site.enabled)
      .toBe(false);
    await ui.screenshot({ path: `${evidence}-shield-popup.png` });
    await ui
      .getByRole("button", { name: "Close Lunar Shield", exact: true })
      .click();
    await ui.locator(".modal-backdrop").waitFor({ state: "detached" });
    await waitNative(1);
    assert.equal(
      await request(aURL, asset("ads.lunar-shield.test", "site-paused")),
      "allowed",
    );
    assert.equal(
      await request(bURL, asset("ads.lunar-shield.test", "unrelated-site")),
      "blocked",
    );
    assert.equal((await state(other)).protection.site.counters.ads, 1);
    await api("setShieldSite", origin, null);
    await api("setShieldSite", origin, {
      allowedRequests: [
        { hostname: "ads.lunar-shield.test", resourceType: "script" },
      ],
    });
    assert.equal(
      await request(aURL, asset("ads.lunar-shield.test", "site-script-allow")),
      "allowed",
    );
    assert.equal(
      await request(
        aURL,
        asset("ads.lunar-shield.test", "site-image-block", "png"),
        "image",
      ),
      "blocked",
    );
    assert.equal(
      await request(bURL, asset("ads.lunar-shield.test", "no-allowance-leak")),
      "blocked",
    );
    await api("setShieldSite", origin, null);
    observations.checks.push(
      "actual compact popup toggle, native-view occlusion, exact-origin/resource isolation and reset",
    );
    const beforeCookieHeaders = (await state()).protection.site.counters
      .cookies;
    assert.equal(
      await request(
        aURL,
        asset("cookies.lunar-shield.test", "cookie-response-on") +
          "&setCookie=1",
        "fetch",
      ),
      "allowed",
    );
    await expect
      .poll(async () => (await state()).protection.site.counters.cookies)
      .toBeGreaterThanOrEqual(beforeCookieHeaders + 1);
    await api("setShieldSite", origin, { blockThirdPartyCookies: false });
    const unfilteredHeaders = (await state()).protection.site.counters.cookies;
    assert.equal(
      await request(
        aURL,
        asset("cookies.lunar-shield.test", "cookie-response-off") +
          "&setCookie=1",
        "fetch",
      ),
      "allowed",
    );
    assert.equal(
      (await state()).protection.site.counters.cookies,
      unfilteredHeaders,
    );
    assert.equal(cookiesSeen.get("cookie-response-on") || "", "");
    await api("setShieldSite", origin, null);
    observations.checks.push(
      "native third-party Set-Cookie interception and exact-site cookie-policy override; not full storage partitioning",
    );

    const dashboard = await api("createTab", "lunar://shield");
    created.push(dashboard.id);
    await waitNative(0);
    const panel = ui.getByRole("region", { name: "Lunar Shield dashboard" });
    await expect(panel).toBeVisible();
    const sections = panel.getByRole("navigation", { name: "Shield sections" });
    await expect(sections.getByRole("button")).toHaveCount(8);
    await sections
      .getByRole("button", { name: "Custom rules", exact: true })
      .click();
    await panel
      .getByRole("textbox", { name: "Network rule", exact: true })
      .fill("||custom.lunar-shield.test^$script");
    await panel.getByRole("button", { name: "Add rule", exact: true }).click();
    await expect
      .poll(async () =>
        (await state()).protection.config.rules.some(
          (rule) => rule.text === "||custom.lunar-shield.test^$script",
        ),
      )
      .toBe(true);
    const custom = (await state()).protection.config.rules.find(
      (rule) => rule.text === "||custom.lunar-shield.test^$script",
    );
    assert.equal(
      await request(aURL, asset("custom.lunar-shield.test", "custom-block")),
      "blocked",
    );
    assert.equal(
      await request(
        aURL,
        asset("custom.lunar-shield.test", "custom-resource-allow", "png"),
        "image",
      ),
      "allowed",
    );
    await expect(
      panel.getByRole("checkbox", { name: "Enabled rule", exact: true }),
    ).toBeEnabled();
    await panel
      .getByRole("checkbox", { name: "Enabled rule", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).protection.config.rules.find(
            (rule) => rule.id === custom.id,
          ).enabled,
      )
      .toBe(false);
    assert.equal(
      await request(aURL, asset("custom.lunar-shield.test", "custom-disabled")),
      "allowed",
    );
    const beforeImport = (await state()).protection.config.rules.length;
    await assert.rejects(
      () =>
        api(
          "importShieldRules",
          "||valid.example.net^\nexample.org##+js(noop)",
        ),
      /Line 2/,
    );
    assert.equal((await state()).protection.config.rules.length, beforeImport);
    await api("importShieldRules", "@@||ads.lunar-shield.test^$script");
    assert.equal(
      await request(aURL, asset("ads.lunar-shield.test", "custom-exception")),
      "allowed",
      "An exception-only custom engine must override core blocks",
    );
    const exception = (await state()).protection.config.rules.find(
      (rule) => rule.text === "@@||ads.lunar-shield.test^$script",
    );
    await api("deleteShieldRule", exception.id);
    const exportedFile = path.join(profile, "shield-native-rules.json");
    const exported = await electron.evaluate(
      async ({ dialog, BrowserWindow }, filename) => {
        const old = dialog.showSaveDialog;
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: filename,
        });
        try {
          return await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
            "window.lunarAPI.exportShieldRules()",
          );
        } finally {
          dialog.showSaveDialog = old;
        }
      },
      exportedFile,
    );
    assert.equal(exported, true);
    assert.ok(
      JSON.parse(fs.readFileSync(exportedFile, "utf8")).rules.some(
        (rule) => rule.enabled === false && rule.text === custom.text,
      ),
    );
    observations.checks.push(
      "real packaged worker path, UI custom-rule add/toggle, actual resource matching, atomic invalid import, exception-only rule and native-dialog export",
    );

    await sections
      .getByRole("button", { name: "YouTube privacy", exact: true })
      .click();
    await expect(
      panel.getByText(
        /not independently verified removed YouTube advertisements/,
      ),
    ).toBeVisible();
    const youtube = panel.getByRole("checkbox", {
      name: /YouTube privacy profile/,
    });
    await expect(youtube).toBeEnabled();
    await youtube.click();
    await expect
      .poll(async () => (await state()).protection.youtube.enabled)
      .toBe(false);
    assert.equal(
      (await api("getSettings")).shield.enabled,
      previous.settings.shield.enabled,
    );
    assert.equal(
      await request(
        aURL,
        asset("ads.lunar-shield.test", "youtube-toggle-independent"),
      ),
      "blocked",
    );
    await api("youtubeProtection", { type: "reset" });
    await sections
      .getByRole("button", { name: "Statistics", exact: true })
      .click();
    await expect(panel.getByRole("table")).toBeVisible();
    await panel
      .getByRole("combobox", { name: "Statistics period" })
      .selectOption("all");
    await ui.screenshot({ path: `${evidence}-shield-dashboard.png` });
    observations.checks.push(
      "dedicated YouTube UI toggle/reset independence and truthful activity language; no live-site/player assertion",
    );

    await api("switchTab", a.id);
    await waitNative(1);
    await api("setSitePermission", origin, "notifications", "block");
    assert.equal(
      await native(aURL, "Notification.requestPermission()"),
      "denied",
    );
    await assert.rejects(
      () => confirm("setSitePermission", [origin, "notifications", "allow"], 0),
      /cancelled/,
    );
    assert.ok(
      (await api("getSitePrivacy", origin)).denials.includes("notifications"),
    );
    await confirm("setSitePermission", [origin, "notifications", "allow"]);
    assert.equal(
      await native(
        aURL,
        "navigator.permissions.query({name:'notifications'}).then(permission=>permission.state)",
      ),
      "granted",
    );
    assert.equal(await native(aURL, "typeof window.lunarAPI"), "undefined");
    await api("resetSitePermissions", origin);
    assert.deepEqual((await api("getSitePrivacy", origin)).grants, []);
    observations.checks.push(
      "real Chromium notifications deny/confirmed-allow/Ask, cancelled native policy confirmation and no website preload bridge (not camera/OS-consent certification)",
    );

    await native(
      aURL,
      "localStorage.setItem('shield-native-private','remove-me')",
    );
    await native(
      bURL,
      "localStorage.setItem('shield-native-private','keep-me')",
    );
    await electron.evaluate(
      async ({ session }, { origin, other }) => {
        const web = session.fromPartition("persist:lunar-web");
        await web.cookies.set({
          url: origin,
          name: "shield_native_private",
          value: "private-fixture-cookie-never-in-overview",
          httpOnly: true,
        });
        await web.cookies.set({
          url: other,
          name: "shield_native_keep",
          value: "other-fixture",
          httpOnly: true,
        });
      },
      { origin, other },
    );
    const overview = await api("getPrivacyOverview");
    assert.ok(overview.cookies >= 2);
    assert.equal(overview.storageBytesAvailable, false);
    assert.ok(
      !JSON.stringify(overview).includes(
        "private-fixture-cookie-never-in-overview",
      ),
    );
    await assert.rejects(
      () => api("clearSelectedData", { range: "hour", types: ["cookies"] }),
      /Invalid request/,
    );
    await assert.rejects(
      () =>
        confirm(
          "clearSelectedData",
          [{ origin, range: "all", types: ["cookies", "storage"] }],
          0,
        ),
      /cancelled/,
    );
    assert.equal(
      await native(aURL, "localStorage.getItem('shield-native-private')"),
      "remove-me",
    );
    await confirm("clearSelectedData", [
      { origin, range: "all", types: ["cookies", "storage", "cache"] },
    ]);
    assert.equal((await api("getSitePrivacy", origin)).cookies, 0);
    assert.ok((await api("getSitePrivacy", other)).cookies >= 1);
    await api("reloadTab", a.id);
    await waitTab(a.id, aURL);
    assert.equal(
      await native(aURL, "localStorage.getItem('shield-native-private')"),
      null,
    );
    assert.equal(
      await native(bURL, "localStorage.getItem('shield-native-private')"),
      "keep-me",
    );
    observations.checks.push(
      "actual privacy inventory without values, rejected unsupported range/cancelled deletion, Chromium selected cookies/cache/storage clearing preserves unrelated origin",
    );

    const checked = await api("refreshShield", "easyprivacy"),
      source = checked.lists.find((list) => list.id === "easyprivacy");
    if (source.ruleCount > 0) {
      assert.ok(source.updatedAt && source.checkedAt);
      observations.listUpdate = {
        status: "passed",
        rules: source.ruleCount,
        rejected: source.rejected,
        updatedAt: source.updatedAt,
      };
    } else {
      // External availability is evidence, not a fake integration pass. Invalid
      // returned filter data/worker/save errors remain hard failures.
      assert.match(
        source.error || "",
        /fetch|net::|HTTP (?:403|429|5\d\d)|timeout|network/i,
      );
      observations.listUpdate = {
        status: "external-source-unreachable",
        error: source.error,
      };
      console.warn(`Native Shield list update unverified: ${source.error}`);
    }
    const beforeClear = (await state()).protection.statistics.periods.all.totals
      .blocked;
    assert.ok(beforeClear > 0);
    await confirm("clearShieldHistory");
    assert.equal(
      (await state()).protection.statistics.periods.all.totals.blocked,
      0,
    );
    assert.equal(
      await request(aURL, asset("ads.lunar-shield.test", "post-clear-block")),
      "blocked",
    );
    await expect
      .poll(
        async () =>
          (await state()).protection.statistics.periods.all.totals.blocked,
      )
      .toBe(1);
    observations.checks.push(
      "actual aggregate clear through confirmed IPC, new terminal outcomes counted after reset",
    );
    observations.statistics = (await state()).protection.statistics;
    fs.writeFileSync(
      `${evidence}-shield-verification.json`,
      JSON.stringify(observations, null, 2) + "\n",
    );
    console.log(
      `PASS: Shield 2 native controlled integration: ${observations.checks.length} groups; source update ${observations.listUpdate.status}. Real YouTube playback/sign-in/ad outcomes are not verified.`,
    );
  } finally {
    const current = await api("bootstrap").catch(() => null);
    if (current) {
      for (const id of created.reverse())
        if (current.tabs.tabs.some((tab) => tab.id === id))
          await api("closeTab", id);
      if (current.tabs.tabs.some((tab) => tab.id === previous.tabs.activeTabId))
        await api("switchTab", previous.tabs.activeTabId);
      await waitNative(1);
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

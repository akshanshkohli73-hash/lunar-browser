// Optional public-site observations in a disposable native test profile.
// Not bundled. No account, credentials, ad-removal or physical-audio assertion.
import fs from "node:fs";
import { expect } from "@playwright/test";

export async function observeLiveYouTube({ electron, api, evidence }) {
  const result = {
    scope:
      "Public YouTube in the actual native browser, disposable signed-out profile",
    pages: [],
    authenticatedAccount: "not-tested-no-credentials",
    advertisementRemoval: "not-independently-verified",
    mediaOutcome:
      "A progressing media element is not independent verification of content versus an advertisement",
    physicalAudio: "not-certified",
  };
  const tabs = [];
  const deadline = Date.now() + 120000;
  const previous = (await api("bootstrap")).tabs.activeTabId;
  let activeContents;
  const evaluate = (script) => {
    if (Date.now() >= deadline)
      return Promise.reject(
        new Error("Public-site observation budget exhausted"),
      );
    return bounded(
      electron.evaluate(
        ({ webContents }, { id, script }) => {
          const contents = webContents.fromId(id);
          if (!contents || contents.isDestroyed())
            throw new Error("Live observation tab was closed");
          return contents.executeJavaScript(script, true);
        },
        { id: activeContents, script },
      ),
    );
  };
  const bounded = async (operation, timeout = 15000) => {
    let timer;
    try {
      const remaining = Math.min(timeout, deadline - Date.now());
      if (remaining <= 0) {
        void operation.catch(() => {});
        throw new Error("Public-site observation budget exhausted");
      }
      return await Promise.race([
        operation,
        new Promise((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error("Public-site observation timeout")),
            remaining,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const open = async (name, url) => {
    const observation = { name, requested: url, status: "unverified" };
    result.pages.push(observation);
    let tabId;
    try {
      if (Date.now() >= deadline)
        throw new Error("Public-site observation budget exhausted");
      const before = await electron.evaluate(({ webContents }) =>
        webContents.getAllWebContents().map((contents) => contents.id),
      );
      const tab = await api("createTab", url);
      tabs.push(tab.id);
      tabId = tab.id;
      activeContents = await electron.evaluate(
        ({ webContents }, before) =>
          webContents
            .getAllWebContents()
            .find((contents) => !before.includes(contents.id))?.id,
        before,
      );
      if (!activeContents)
        throw new Error("The real observation WebContents was not created");
      await expect
        .poll(
          () =>
            bounded(
              evaluate(
                "({ready:document.readyState,title:document.title,url:location.href,body:document.body?.innerText.slice(0,250)})",
              ),
              4000,
            ),
          { timeout: 15000 },
        )
        .toMatchObject({
          ready: expect.stringMatching(/interactive|complete/),
          url: expect.stringMatching(
            /^https:\/\/(?:www\.|consent\.)?youtube\.com\//,
          ),
        });
      const page = await bounded(
        evaluate(
          "({url:location.href,title:document.title,app:!!document.querySelector('ytd-app,ytd-shorts,ytm-app,#movie_player'),error:document.querySelector('#error-screen,.ytp-error-content-wrap')?.innerText.slice(0,300)||null,consent:location.hostname==='consent.youtube.com'||!!document.querySelector('ytd-consent-bump-v2-lightbox')})",
        ),
      );
      Object.assign(observation, page, {
        status: page.app && !page.consent ? "page-rendered" : "not-verified",
      });
    } catch (error) {
      observation.error = error.message.slice(0, 1200);
      if (tabId) {
        const tab = (await api("bootstrap")).tabs.tabs.find(
          (tab) => tab.id === tabId,
        );
        observation.navigation = tab
          ? { url: tab.url, error: tab.error || null, loading: tab.isLoading }
          : { closed: true };
      }
    }
    return observation;
  };
  try {
    const reachability = await bounded(
      electron.evaluate(async ({ net }) => {
        try {
          const response = await net.fetch("https://www.youtube.com/", {
            credentials: "omit",
            signal: AbortSignal.timeout(10000),
          });
          const observation = {
            reachable: response.ok,
            status: response.status,
            // Electron's net.fetch Response may leave url empty, including on
            // a genuine HTTP response. Do not relabel that as a network error.
            ...(typeof response.url === "string" && URL.canParse(response.url)
              ? { finalOrigin: new URL(response.url).origin }
              : { responseOrigin: "not-exposed-by-response" }),
          };
          await response.body?.cancel();
          return observation;
        } catch (error) {
          return { reachable: false, error: error.message };
        }
      }),
      12000,
    );
    result.reachability = reachability;
    // Main-process fetch and a real tab can have different user agents or
    // upstream treatment. Always attempt the actual native homepage too; a
    // failed preflight alone must not be called a failed browser/player test.
    const home = await open("homepage", "https://www.youtube.com/");
    if (home.consent || home.status !== "page-rendered") {
      result.remaining = home.consent
        ? "Consent interstitial: no acceptance was silently supplied; remaining player/account flows unverified"
        : "Native homepage rendering not verified; later player/account flows unverified";
      return result;
    }
    const search = await open(
      "search",
      "https://www.youtube.com/results?search_query=Big+Buck+Bunny+Blender+Foundation",
    );
    let videoId;
    if (search.status === "page-rendered") {
      try {
        await expect
          .poll(
            () =>
              bounded(
                evaluate(
                  "document.querySelector('ytd-video-renderer a#video-title[href*=\"watch?v=\"]')?.href || null",
                ),
                4000,
              ),
            { timeout: 10000 },
          )
          .toBeTruthy();
        const found = await evaluate(
          "document.querySelector('ytd-video-renderer a#video-title[href*=\"watch?v=\"]')?.href",
        );
        const parsed = new URL(found);
        if (
          parsed.hostname === "www.youtube.com" &&
          /^[\w-]{11}$/.test(parsed.searchParams.get("v") || "")
        )
          videoId = parsed.searchParams.get("v");
      } catch (error) {
        search.videoSelection = error.message;
      }
    }
    if (videoId) {
      const watch = await open(
        "watch",
        `https://www.youtube.com/watch?v=${videoId}`,
      );
      if (watch.status === "page-rendered") {
        try {
          await expect
            .poll(
              () =>
                bounded(evaluate("!!document.querySelector('video')"), 4000),
              { timeout: 10000 },
            )
            .toBe(true);
          await bounded(
            evaluate(
              "document.querySelector('video').play().then(()=>true,error=>error.name+': '+error.message)",
            ),
            10000,
          );
          const before = await evaluate(
            "document.querySelector('video').currentTime",
          );
          await expect
            .poll(
              () =>
                bounded(
                  evaluate("document.querySelector('video').currentTime"),
                  4000,
                ),
              { timeout: 10000 },
            )
            .toBeGreaterThan(before + 0.25);
          watch.playback = "actual-currentTime-progressed";
          watch.media = await evaluate(
            "(()=>{const video=document.querySelector('video');return {paused:video.paused,muted:video.muted,volume:video.volume,width:video.videoWidth,height:video.videoHeight,textTracks:[...video.textTracks].map(track=>({kind:track.kind,mode:track.mode,language:track.language})),playerContainer:!!document.querySelector('.html5-video-player'),captionsControl:!!document.querySelector('.ytp-subtitles-button'),settingsControl:!!document.querySelector('.ytp-settings-button'),signInLink:!!document.querySelector('a[href*=\"accounts.google.com\"]')}})()",
          );
          watch.audible = await electron.evaluate(
            ({ webContents }, id) =>
              webContents.fromId(id).isCurrentlyAudible(),
            activeContents,
          );
          // Exercise the actual player button, not an HTML-video replacement.
          await evaluate(
            "document.querySelector('.ytp-fullscreen-button')?.click()",
          );
          await expect
            .poll(
              () => bounded(evaluate("!!document.fullscreenElement"), 4000),
              { timeout: 5000 },
            )
            .toBe(true);
          watch.fullscreen = "player-button-entered";
          await bounded(evaluate("document.exitFullscreen().then(()=>true)"));
          watch.fullscreenExit = await evaluate(
            "document.fullscreenElement===null",
          );
          if (watch.media.captionsControl) {
            watch.captionsBefore = await evaluate(
              "document.querySelector('.ytp-subtitles-button').getAttribute('aria-pressed')",
            );
            await evaluate(
              "document.querySelector('.ytp-subtitles-button').click()",
            );
            watch.captionsAfter = await evaluate(
              "document.querySelector('.ytp-subtitles-button').getAttribute('aria-pressed')",
            );
          }
          watch.quality =
            "settings control observed only; quality selection and keyboard actions not certified";
        } catch (error) {
          watch.playerUnverified = error.message;
        }
      }
      await open("embed", `https://www.youtube.com/embed/${videoId}`);
    } else
      result.watchAndEmbed =
        "No genuine search-result video ID available; no invented ID or passing player result";
    await open("Shorts", "https://www.youtube.com/shorts/");
    await open("live directory", "https://www.youtube.com/feed/live");
    result.liveStreamPlayback = "not-certified-directory-is-not-a-live-stream";
    result.protection = (
      await api("getShieldState", "https://www.youtube.com")
    ).protection.youtube;
    return result;
  } catch (error) {
    result.error = error.message;
    return result;
  } finally {
    for (const id of tabs.reverse()) await api("closeTab", id).catch(() => {});
    if (previous) await api("switchTab", previous).catch(() => {});
    fs.writeFileSync(
      `${evidence}-youtube-live-observations.json`,
      JSON.stringify(result, null, 2) + "\n",
    );
    if (process.env.GITHUB_ACTIONS === "true")
      console.log(
        `::notice title=Public YouTube observations (not certification)::${JSON.stringify(result).replaceAll("%", "%25").replaceAll("\n", "%0A").replaceAll("\r", "%0D")}`,
      );
    else
      console.log(
        `Public YouTube observations (not certification): ${JSON.stringify(result)}`,
      );
  }
}

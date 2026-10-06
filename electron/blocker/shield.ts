import { session, WebRequest } from 'electron';
import { ShieldSettings, ShieldStats } from '../types';

export class LunarShield {
  private settings: ShieldSettings = {
    enabled: true,
    ads: true,
    trackers: true,
    popups: true,
    telemetry: true,
    social: true,
    cryptomining: true,
    annoyances: true,
    autoplay: false,
    fingerprintProtection: true,
    allowlist: [],
  };

  private stats: ShieldStats = {
    totalBlocked: 0,
    adsBlocked: 0,
    trackersBlocked: 0,
    analyticsBlocked: 0,
    telemetryBlocked: 0,
    cryptominersBlocked: 0,
    socialBlocked: 0,
    popupsBlocked: 0,
    annoyancesBlocked: 0,
  };

  // Known patterns for network blocking
  private adPatterns = [
    '/ads/', '/adserver', 'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'adnxs.com', 'adsystem.com', 'amazon-adsystem.com', 'pagead2.googlesyndication.com',
    'adservice.google.com', 'taboola.com', 'outbrain.com', 'popads.net', 'propellerads.com'
  ];

  private trackerPatterns = [
    'google-analytics.com', 'analytics.', 'segment.com', 'mixpanel.com', 'hotjar.com',
    'clarity.ms', 'quantserve.com', 'scorecardresearch.com', 'crazyegg.com', 'fullstory.com',
    'pixel.facebook.com', 'connect.facebook.net/en_US/fbevents.js', 'tr.snapchat.com'
  ];

  private telemetryPatterns = [
    'telemetry.', 'sentry.io', 'bugsnag.com', 'logrocket.com', 'datadoghq.com',
    'newrelic.com', 'collector.'
  ];

  private minerPatterns = [
    'coinhive.min.js', 'coin-hive.com', 'crypto-loot.com', 'authedmine.com', 'minero.cc'
  ];

  private onStatsChangeCallback?: (stats: ShieldStats) => void;

  constructor(onStatsChange?: (stats: ShieldStats) => void) {
    this.onStatsChangeCallback = onStatsChange;
    this.initInterceptor();
  }

  public getSettings(): ShieldSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<ShieldSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  public getStats(): ShieldStats {
    return { ...this.stats };
  }

  public toggleAllowlist(hostname: string) {
    const index = this.settings.allowlist.indexOf(hostname);
    if (index >= 0) {
      this.settings.allowlist.splice(index, 1);
    } else {
      this.settings.allowlist.push(hostname);
    }
  }

  private initInterceptor() {
    const filter = { urls: ['<all_urls>'] };

    session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
      if (!this.settings.enabled) {
        return callback({ cancel: false });
      }

      const url = details.url.toLowerCase();

      // Check site allowlist
      try {
        const hostname = new URL(url).hostname;
        if (this.settings.allowlist.includes(hostname)) {
          return callback({ cancel: false });
        }
      } catch (_) {}

      // Block Ads
      if (this.settings.ads && this.adPatterns.some((pattern) => url.includes(pattern))) {
        this.stats.adsBlocked++;
        this.stats.totalBlocked++;
        this.notifyStats();
        return callback({ cancel: true });
      }

      // Block Trackers
      if (this.settings.trackers && this.trackerPatterns.some((pattern) => url.includes(pattern))) {
        this.stats.trackersBlocked++;
        this.stats.totalBlocked++;
        this.notifyStats();
        return callback({ cancel: true });
      }

      // Block Telemetry
      if (this.settings.telemetry && this.telemetryPatterns.some((pattern) => url.includes(pattern))) {
        this.stats.telemetryBlocked++;
        this.stats.totalBlocked++;
        this.notifyStats();
        return callback({ cancel: true });
      }

      // Block Cryptominers
      if (this.settings.cryptomining && this.minerPatterns.some((pattern) => url.includes(pattern))) {
        this.stats.cryptominersBlocked++;
        this.stats.totalBlocked++;
        this.notifyStats();
        return callback({ cancel: true });
      }

      callback({ cancel: false });
    });

    // Strip User-Agent tracking parameters if fingerprint protection enabled
    session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
      if (this.settings.enabled && this.settings.fingerprintProtection) {
        delete details.requestHeaders['X-Client-Data'];
        delete details.requestHeaders['DNT'];
      }
      callback({ requestHeaders: details.requestHeaders });
    });
  }

  private notifyStats() {
    if (this.onStatsChangeCallback) {
      this.onStatsChangeCallback(this.getStats());
    }
  }
}

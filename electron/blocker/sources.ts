import type { CustomSubscription, ShieldSource } from "../../shared/shield";
import { trustedSubscriptionURL } from "../../shared/filter-source-url";
export { trustedSubscriptionURL } from "../../shared/filter-source-url";

/** Network-only adaptations. All downloads are data; no list directives/code run. */
export const FILTER_SOURCES: Record<string, ShieldSource> = {
  stevenblack: {
    id: "stevenblack",
    name: "StevenBlack Unified Hosts",
    category: "other",
    format: "hosts",
    description:
      "Mixed advertising/tracking hosts. Reported as Other, never as malware.",
    homepage: "https://github.com/StevenBlack/hosts",
    license: "MIT; included sources retain their licenses",
    urls: ["https://api.github.com/repos/StevenBlack/hosts/contents/hosts"],
  },
  easyprivacy: {
    id: "easyprivacy",
    name: "EasyPrivacy · network subset",
    category: "trackers",
    format: "abp",
    description:
      "Maintained tracking network filters; cosmetic, regex and response modifiers are excluded.",
    homepage: "https://github.com/easylist/easylist/tree/master/easyprivacy",
    license: "GPL-3.0-or-later OR CC-BY-SA-3.0-or-later · The EasyList authors",
    urls: [
      "easyprivacy_general.txt",
      "easyprivacy_thirdparty.txt",
      "easyprivacy_trackingservers.txt",
      "easyprivacy_allowlist.txt",
    ].map(
      (file) =>
        `https://api.github.com/repos/easylist/easylist/contents/easyprivacy/${file}`,
    ),
  },
  easylist: {
    id: "easylist",
    name: "EasyList · network subset",
    category: "ads",
    format: "abp",
    description:
      "Advertising network filters, not element hiding or video-ad removal.",
    homepage: "https://github.com/easylist/easylist/tree/master/easylist",
    license: "GPL-3.0-or-later OR CC-BY-SA-3.0-or-later · The EasyList authors",
    urls: [
      "easylist_adservers.txt",
      "easylist_general_block.txt",
      "easylist_general_block_dimensions.txt",
      "easylist_specific_block.txt",
      "easylist_specific_block_popup.txt",
      "easylist_thirdparty.txt",
      "easylist_allowlist.txt",
      "easylist_allowlist_dimensions.txt",
    ].map(
      (file) =>
        `https://api.github.com/repos/easylist/easylist/contents/easylist/${file}`,
    ),
  },
  "threat-intelligence": {
    id: "threat-intelligence",
    name: "HaGeZi Threat Intelligence · mini",
    category: "malware",
    format: "abp",
    description:
      "Known threat-feed domains, including phishing/malware/scams. A list match is not a forensic verdict or a guarantee of safety.",
    homepage: "https://github.com/hagezi/dns-blocklists",
    license:
      "GPL-3.0-only · Gerd HaGeZi; upstream source attributions retained",
    urls: [
      "https://api.github.com/repos/hagezi/dns-blocklists/contents/adblock/tif.mini.txt",
    ],
  },
};
export function customSource(subscription: CustomSubscription): ShieldSource {
  return {
    id: subscription.id,
    name: subscription.name,
    urls: [trustedSubscriptionURL(subscription.url)],
    category: "custom",
    format: "abp",
    homepage: subscription.url,
    license:
      "User-selected subscription; see upstream license before redistribution",
    description:
      "Custom network subscription. Enable only if you trust its publisher and license.",
    custom: true,
  };
}

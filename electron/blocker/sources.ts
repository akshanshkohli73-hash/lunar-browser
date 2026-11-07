/** Only fixed public endpoints; no renderer-controlled URLs or automatic background updates. */
export const FILTER_SOURCES = {
  stevenblack: {
    name: "StevenBlack Unified Hosts",
    homepage: "https://github.com/StevenBlack/hosts",
    license: "MIT; included sources retain their licenses",
    urls: ["https://api.github.com/repos/StevenBlack/hosts/contents/hosts"],
  },
  easyprivacy: {
    name: "EasyPrivacy network subset",
    homepage: "https://github.com/easylist/easylist",
    license: "GPL-3.0-or-later or CC-BY-SA-3.0-or-later (EasyList authors)",
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
} as const;

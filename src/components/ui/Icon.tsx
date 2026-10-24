import type { SVGProps } from "react";
const paths = {
  calendar:
    "M4 5h16v16H4V5ZM4 10h16M8 3v4m8-4v4M8 14h1m3 0h1m3 0h1M8 18h1m3 0h1",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 6v6l4 2",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  up: "m6 14 6-6 6 6",
  down: "m6 10 6 6 6-6",
  move: "M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3",
  image: "M3 4h18v16H3V4Zm0 12 5-5 5 5 3-3 5 5M15 8h.01",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  moon: "M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z",
  plus: "M12 5v14M5 12h14",
  x: "m6 6 12 12M6 18 18 6",
  back: "m14 6-6 6 6 6",
  forward: "m10 6 6 6-6 6",
  reload: "M20 7v5h-5M20 12a8 8 0 1 0-2 5",
  stop: "M6 6h12v12H6Z",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z",
  history: "M3 4v5h5M3 9a9 9 0 1 1 0 7M12 7v5l3 2",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  settings: "M4 7h16M4 17h16M9 4v6M15 14v6",
  palette:
    "M12 3a9 9 0 1 0 0 18c3 0-1-4 2-5h3c7-2 2-13-5-13ZM7 9h.01M11 6h.01M16 8h.01M7 14h.01",
  puzzle:
    "M4 4h6c-2-4 6-4 4 0h6v6c4-2 4 6 0 4v6h-6c2-4-6-4-4 0H4v-6c4 2 4-6 0-4V4Z",
  sparkles: "m12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7ZM20 2v4m-2-2h4",
  book: "M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2V4Zm9 2v15",
  folder: "M3 6h6l2 2h10v12H3V6Z",
  desktop: "M3 4h18v13H3V4Zm9 13v4m-5 0h10",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-2 4 7 7",
  check: "m5 12 4 4L19 6",
  pin: "m8 3 8 0-1 6 4 5H5l4-5-1-6Zm4 11v7",
  volume: "M3 9h4l5-5v16l-5-5H3V9Zm13-2c4 3 4 7 0 10",
  lock: "M5 11h14v10H5V11Zm3 0V7a4 4 0 0 1 8 0v4",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  edit: "m4 16 12-12 4 4L8 20H4v-4Z",
  minimize: "M5 12h14",
  maximize: "M5 5h14v14H5V5Z",
  alert: "m12 3 10 18H2L12 3Zm0 6v5m0 3h.01",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}

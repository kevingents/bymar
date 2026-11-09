import type { SVGProps } from "react";

/** Lijn-iconen, 24x24 op currentColor. Nieuwe iconen: voeg een pad toe aan PATHS. */
const PATHS = {
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  minus: "M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  "arrow-left": "M19 12H5M11 6l-6 6 6 6",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  "arrow-up": "M12 19V5M6 11l6-6 6 6",
  "arrow-down": "M12 5v14M6 13l6 6 6-6",
  "chevron-right": "M9 6l6 6-6 6",
  "chevron-down": "M6 9l6 6 6-6",
  image: "M4 5h16v14H4zM4 15l4.5-4.5L13 15l2.5-2.5L20 17M15.5 9.5h.01",
  sparkles:
    "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6z",
  chat: "M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5",
  hammer: "M14 4l6 6-2.5 2.5-6-6zM11.5 6.5L4 14l3 3 7.5-7.5M7 17l-3 3",
  cart: "M3 4h2.5l2.2 11h10.6L20.5 7H7M9.5 19.5h.01M17 19.5h.01",
  plan: "M4 4h16v16H4zM4 11h7V4M11 16v4M15 11h5M11 11v2",
  cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9",
  share: "M12 4v11M8 8l4-4 4 4M5 13v6h14v-6",
  trash: "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10.5 11v5.5M13.5 11v5.5",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
  camera: "M4 8h3.5L9 5.5h6L16.5 8H20v11H4zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
  send: "M4 12l16-8-6 16-2.5-6.5zM11.5 13.5L20 4",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  copy: "M8 8h11v12H8zM5 16V4h11",
  ruler: "M3 16L16 3l5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2",
  home: "M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-6h4v6",
  logout: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  wand: "M4 20L15 9M13 7l4 4M17 3v3M15.5 4.5h3M20 8v2M19 9h2",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  rotate: "M20 12a8 8 0 11-2.3-5.6M20 4v4.5h-4.5",
  door: "M6 20V4h9v16M4 20h16M12.5 12h.01",
  window: "M5 4h14v16H5zM12 4v16M5 12h14",
  walk: "M13 5.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM10 21l2-6 3 3v3M9 11l3-3.5 3 2.5 3 1M12 7.5l-2 5.5",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5a7.5 7.5 0 0115 0",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.5 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  sofa: "M4 11V8.5A2.5 2.5 0 016.5 6h11A2.5 2.5 0 0120 8.5V11M3 11h3v4h12v-4h3v6H3zM5 17v2M19 17v2",
  compass: "M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z",
  mail: "M3.5 6h17v12h-17zM3.5 6.5L12 13l8.5-6.5",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  save: "M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6",
  loader: "M12 3a9 9 0 109 9",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.5h.01",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  euro: "M17.5 6.5A6.5 6.5 0 0012 5a6.5 6.5 0 000 14 6.5 6.5 0 005.5-1.5M4 10h9M4 14h9",
  warning: "M12 4l9 16H3zM12 10v4.5M12 17.5h.01",
  shield: "M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z",
  palette: "M12 3a9 9 0 100 18c1.4 0 2-1 2-2s-.6-1.4-.6-2.4c0-1.1.9-1.6 2-1.6H18a3 3 0 003-3c0-5-4-9-9-9zM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01",
  swap: "M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  saw:"M3 15l12-9 6 4-12 9zM6 13l1 2M9 11l1 2M12 9l1 2",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.6,
  className,
  ...rest
}: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={[name === "loader" ? "animate-spin" : "", className].filter(Boolean).join(" ")}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

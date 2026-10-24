import type { ThemeTokens } from "../../shared/schemas";
export type { ThemeTokens } from "../../shared/schemas";

export const BUILTIN_THEMES: Record<string, ThemeTokens> = {
  "lunar-dark": {
    id: "lunar-dark",
    name: "Lunar Dark",
    description:
      "Futuristic near-black AMOLED theme with moonlight cyan & violet accents.",
    category: "dark",
    colors: {
      bg: "#050508",
      bgSecondary: "#0d0f17",
      surface: "#131622",
      surfaceHover: "#1c2032",
      border: "rgba(255, 255, 255, 0.12)",
      text: "#f1f5f9",
      textMuted: "#94a3b8",
      primary: "#00f0ff",
      secondary: "#8a2be2",
      accent: "#a3e635",
      glow: "rgba(0, 240, 255, 0.25)",
    },
    appearance: {
      glassIntensity: 0.6,
      blur: 16,
      glowIntensity: 0.7,
      shadowStrength: 0.5,
      borderBrightness: 0.15,
      cornerRadius: 8,
    },
    typography: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "comfortable",
      uiScale: 1.0,
    },
    layout: {
      density: "comfortable",
      tabStyle: "rounded",
    },
  },

  "lunar-coquette": {
    id: "lunar-coquette",
    name: "Lunar Coquette",
    description:
      "The original green Coquette spirit: meadow, warm cream and a touch of rose.",
    category: "pastel",
    colors: {
      bg: "#f5f4ea",
      bgSecondary: "#e6ecdf",
      surface: "#fffdf7",
      surfaceHover: "#edf1e5",
      border: "rgba(60, 81, 55, 0.18)",
      text: "#26372c",
      textMuted: "#596453",
      primary: "#37543d",
      secondary: "#c4d3b1",
      accent: "#b6939b",
      glow: "rgba(55, 84, 61, 0.10)",
    },
    appearance: {
      glassIntensity: 0.65,
      blur: 12,
      glowIntensity: 0.1,
      shadowStrength: 0.2,
      borderBrightness: 0.3,
      cornerRadius: 12,
    },
    typography: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: "comfortable",
      uiScale: 1.0,
    },
    layout: {
      density: "comfortable",
      tabStyle: "rounded",
    },
  },
  "rose-coquette": {
    id: "rose-coquette",
    name: "Rose Coquette",
    description:
      "Soft macOS-inspired coquette aesthetic with cream, rose & lavender.",
    category: "pastel",
    colors: {
      bg: "#faf7f2",
      bgSecondary: "#f5e8ee",
      surface: "#ffffff",
      surfaceHover: "#f8eaf0",
      border: "rgba(125, 29, 69, 0.16)",
      text: "#352631",
      textMuted: "#796773",
      primary: "#7d1d45",
      secondary: "#f4b6cb",
      accent: "#b8a1d9",
      glow: "rgba(125, 29, 69, 0.12)",
    },
    appearance: {
      glassIntensity: 0.8,
      blur: 20,
      glowIntensity: 0.3,
      shadowStrength: 0.2,
      borderBrightness: 0.3,
      cornerRadius: 14,
    },
    typography: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: "comfortable",
      uiScale: 1.0,
    },
    layout: {
      density: "spacious",
      tabStyle: "pill",
    },
  },

  moonlight: {
    id: "moonlight",
    name: "Moonlight",
    description: "Pearl white, pale blue and silver elegance.",
    category: "light",
    colors: {
      bg: "#f8fafc",
      bgSecondary: "#f1f5f9",
      surface: "#ffffff",
      surfaceHover: "#e2e8f0",
      border: "rgba(203, 213, 225, 0.5)",
      text: "#0f172a",
      textMuted: "#64748b",
      primary: "#0369a1",
      secondary: "#818cf8",
      accent: "#34d399",
      glow: "rgba(56, 189, 248, 0.2)",
    },
    appearance: {
      glassIntensity: 0.5,
      blur: 12,
      glowIntensity: 0.4,
      shadowStrength: 0.3,
      borderBrightness: 0.4,
      cornerRadius: 10,
    },
    typography: {
      fontFamily: "Inter, sans-serif",
      fontSize: "comfortable",
      uiScale: 1.0,
    },
    layout: {
      density: "comfortable",
      tabStyle: "rounded",
    },
  },

  nebula: {
    id: "nebula",
    name: "Nebula",
    description: "Deep cosmic violet with radiant magenta and cyan tones.",
    category: "cyber",
    colors: {
      bg: "#0a0518",
      bgSecondary: "#120b2a",
      surface: "#1e123a",
      surfaceHover: "#2a1a4e",
      border: "rgba(168, 85, 247, 0.25)",
      text: "#f3e8ff",
      textMuted: "#a855f7",
      primary: "#c084fc",
      secondary: "#f43f5e",
      accent: "#22d3ee",
      glow: "rgba(192, 132, 252, 0.3)",
    },
    appearance: {
      glassIntensity: 0.7,
      blur: 18,
      glowIntensity: 0.8,
      shadowStrength: 0.6,
      borderBrightness: 0.2,
      cornerRadius: 10,
    },
    typography: {
      fontFamily: "Inter, sans-serif",
      fontSize: "comfortable",
      uiScale: 1.0,
    },
    layout: {
      density: "comfortable",
      tabStyle: "rounded",
    },
  },

  sakura: {
    id: "sakura",
    name: "Sakura",
    description: "Pastel cherry blossom pink, soft cream and warm blush.",
    category: "pastel",
    colors: {
      bg: "#fff5f7",
      bgSecondary: "#ffe6ec",
      surface: "#ffffff",
      surfaceHover: "#ffd6e0",
      border: "rgba(244, 114, 182, 0.3)",
      text: "#4a2032",
      textMuted: "#9f5874",
      primary: "#9d174d",
      secondary: "#fb7185",
      accent: "#fbbf24",
      glow: "rgba(244, 114, 182, 0.25)",
    },
    appearance: {
      glassIntensity: 0.75,
      blur: 16,
      glowIntensity: 0.4,
      shadowStrength: 0.25,
      borderBrightness: 0.3,
      cornerRadius: 12,
    },
    typography: {
      fontFamily: "Inter, sans-serif",
      fontSize: "comfortable",
      uiScale: 1.0,
    },
    layout: {
      density: "comfortable",
      tabStyle: "pill",
    },
  },

  "pastel-forest": {
    id: "pastel-forest",
    name: "Pastel Forest",
    description: "Pistachio green, sage leaf, and warm linen.",
    category: "pastel",
    colors: {
      bg: "#f2f7f4",
      bgSecondary: "#e1ede6",
      surface: "#ffffff",
      surfaceHover: "#d2e4d9",
      border: "rgba(74, 124, 89, 0.25)",
      text: "#1e3323",
      textMuted: "#5a7861",
      primary: "#4a7c59",
      secondary: "#8fc0a9",
      accent: "#f8c390",
      glow: "rgba(74, 124, 89, 0.2)",
    },
    appearance: {
      glassIntensity: 0.7,
      blur: 14,
      glowIntensity: 0.3,
      shadowStrength: 0.2,
      borderBrightness: 0.3,
      cornerRadius: 10,
    },
    typography: {
      fontFamily: "Inter, sans-serif",
      fontSize: "comfortable",
      uiScale: 1.0,
    },
    layout: {
      density: "comfortable",
      tabStyle: "rounded",
    },
  },

  "ocean-glass": {
    id: "ocean-glass",
    name: "Ocean Glass",
    description: "Powder aqua, deep marine blue and crisp translucent glass.",
    category: "cyber",
    colors: {
      bg: "#04121e",
      bgSecondary: "#092133",
      surface: "#0f3148",
      surfaceHover: "#174360",
      border: "rgba(56, 189, 248, 0.25)",
      text: "#e0f2fe",
      textMuted: "#7dd3fc",
      primary: "#38bdf8",
      secondary: "#2dd4bf",
      accent: "#a7f3d0",
      glow: "rgba(56, 189, 248, 0.3)",
    },
    appearance: {
      glassIntensity: 0.8,
      blur: 20,
      glowIntensity: 0.6,
      shadowStrength: 0.4,
      borderBrightness: 0.2,
      cornerRadius: 10,
    },
    typography: {
      fontFamily: "Inter, sans-serif",
      fontSize: "comfortable",
      uiScale: 1.0,
    },
    layout: {
      density: "comfortable",
      tabStyle: "rounded",
    },
  },

  "amoled-void": {
    id: "amoled-void",
    name: "AMOLED Void",
    description:
      "Absolute OLED pitch black with minimal high-contrast white accents.",
    category: "dark",
    colors: {
      bg: "#000000",
      bgSecondary: "#0a0a0a",
      surface: "#141414",
      surfaceHover: "#222222",
      border: "rgba(255, 255, 255, 0.15)",
      text: "#ffffff",
      textMuted: "#888888",
      primary: "#ffffff",
      secondary: "#aaaaaa",
      accent: "#333333",
      glow: "rgba(255, 255, 255, 0.1)",
    },
    appearance: {
      glassIntensity: 0.2,
      blur: 0,
      glowIntensity: 0.1,
      shadowStrength: 0.1,
      borderBrightness: 0.2,
      cornerRadius: 4,
    },
    typography: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "compact",
      uiScale: 1.0,
    },
    layout: {
      density: "compact",
      tabStyle: "minimal",
    },
  },

  terminal: {
    id: "terminal",
    name: "Terminal",
    description: "Retro hacker green phosphor on pitch black.",
    category: "dark",
    colors: {
      bg: "#050a05",
      bgSecondary: "#0a140a",
      surface: "#0f1f0f",
      surfaceHover: "#162e16",
      border: "rgba(34, 197, 94, 0.3)",
      text: "#4ade80",
      textMuted: "#16a34a",
      primary: "#22c55e",
      secondary: "#86efac",
      accent: "#facc15",
      glow: "rgba(34, 197, 94, 0.3)",
    },
    appearance: {
      glassIntensity: 0.3,
      blur: 4,
      glowIntensity: 0.8,
      shadowStrength: 0.3,
      borderBrightness: 0.3,
      cornerRadius: 2,
    },
    typography: {
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: "compact",
      uiScale: 1.0,
    },
    layout: {
      density: "compact",
      tabStyle: "minimal",
    },
  },
};

export function foregroundForColor(color: string): string {
  const hex = /^#([a-f\d]{6})$/iu.exec(color);
  const rgb = hex
    ? [0, 2, 4].map((index) => parseInt(hex[1].slice(index, index + 2), 16))
    : (color.match(/\d+(?:\.\d+)?/gu) ?? []).slice(0, 3).map(Number);
  if (rgb.length !== 3) return "#ffffff";
  const channels = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.057 > 1.05 / (luminance + 0.05)
    ? "#17151b"
    : "#ffffff";
}

export function applyThemeTokens(theme: ThemeTokens) {
  const root = document.documentElement;

  root.style.setProperty("--lunar-bg", theme.colors.bg);
  root.style.setProperty("--lunar-bg-secondary", theme.colors.bgSecondary);
  root.style.setProperty("--lunar-surface", theme.colors.surface);
  root.style.setProperty("--lunar-surface-hover", theme.colors.surfaceHover);
  root.style.setProperty("--lunar-border", theme.colors.border);
  root.style.setProperty("--lunar-text", theme.colors.text);
  root.style.setProperty("--lunar-text-muted", theme.colors.textMuted);
  root.style.setProperty("--lunar-primary", theme.colors.primary);
  root.style.setProperty(
    "--lunar-on-primary",
    foregroundForColor(theme.colors.primary),
  );
  root.style.setProperty("--lunar-secondary", theme.colors.secondary);
  root.style.setProperty("--lunar-accent", theme.colors.accent);
  root.style.setProperty("--lunar-glow", theme.colors.glow);

  root.style.setProperty("--lunar-blur", `${theme.appearance.blur}px`);
  root.style.setProperty(
    "--lunar-radius",
    `${theme.appearance.cornerRadius}px`,
  );
  root.style.setProperty("--lunar-font-family", theme.typography.fontFamily);
  root.style.setProperty("--color-background", theme.colors.bg);
  root.style.setProperty("--color-foreground", theme.colors.text);
  root.style.setProperty("--color-muted-foreground", theme.colors.textMuted);
  root.style.setProperty("--color-border", theme.colors.border);
  root.style.setProperty(
    "--lunar-toolbar-height",
    { compact: 36, comfortable: 42, spacious: 48 }[theme.layout.density] + "px",
  );
  root.style.setProperty(
    "--lunar-tab-radius",
    { minimal: 3, rounded: 9, pill: 20 }[theme.layout.tabStyle] + "px",
  );
  root.style.setProperty(
    "--lunar-font-size",
    `${12 * theme.typography.uiScale}px`,
  );
  root.style.setProperty(
    "--lunar-glass-percent",
    `${60 + theme.appearance.glassIntensity * 35}%`,
  );
  root.style.setProperty(
    "--lunar-shadow",
    `0 12px 40px rgba(0,0,0,${theme.appearance.shadowStrength * 0.35})`,
  );
  root.dataset.themeCategory = theme.category;
}

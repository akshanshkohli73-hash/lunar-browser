export interface ThemeTokens {
  id: string;
  name: string;
  description: string;
  category: 'dark' | 'light' | 'pastel' | 'cyber';
  colors: {
    bg: string;
    bgSecondary: string;
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textMuted: string;
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
  };
  appearance: {
    glassIntensity: number; // 0 to 1
    blur: number; // in px
    glowIntensity: number; // 0 to 1
    shadowStrength: number; // 0 to 1
    borderBrightness: number; // 0 to 1
    cornerRadius: number; // in px
  };
  typography: {
    fontFamily: string;
    fontSize: 'compact' | 'comfortable' | 'spacious';
    uiScale: number; // 0.8 to 1.2
  };
  layout: {
    density: 'compact' | 'comfortable' | 'spacious';
    tabStyle: 'minimal' | 'rounded' | 'pill';
  };
}

export const BUILTIN_THEMES: Record<string, ThemeTokens> = {
  'lunar-dark': {
    id: 'lunar-dark',
    name: 'Lunar Dark',
    description: 'Futuristic near-black AMOLED theme with moonlight cyan & violet accents.',
    category: 'dark',
    colors: {
      bg: '#050508',
      bgSecondary: '#0d0f17',
      surface: '#131622',
      surfaceHover: '#1c2032',
      border: 'rgba(255, 255, 255, 0.12)',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      primary: '#00f0ff',
      secondary: '#8a2be2',
      accent: '#a3e635',
      glow: 'rgba(0, 240, 255, 0.25)',
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
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 'comfortable',
      uiScale: 1.0,
    },
    layout: {
      density: 'comfortable',
      tabStyle: 'rounded',
    },
  },

  'lunar-coquette': {
    id: 'lunar-coquette',
    name: 'Lunar Coquette',
    description: 'Soft macOS-inspired coquette aesthetic with pastel mint, cream, rose & lavender.',
    category: 'pastel',
    colors: {
      bg: '#f4f9f4',
      bgSecondary: '#e8f3e8',
      surface: '#ffffff',
      surfaceHover: '#f0f7f0',
      border: 'rgba(168, 213, 186, 0.35)',
      text: '#2d3748',
      textMuted: '#718096',
      primary: '#72b095',
      secondary: '#e8a5b8',
      accent: '#b8a1d9',
      glow: 'rgba(114, 176, 149, 0.2)',
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
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 'comfortable',
      uiScale: 1.0,
    },
    layout: {
      density: 'spacious',
      tabStyle: 'pill',
    },
  },

  'moonlight': {
    id: 'moonlight',
    name: 'Moonlight',
    description: 'Pearl white, pale blue and silver elegance.',
    category: 'light',
    colors: {
      bg: '#f8fafc',
      bgSecondary: '#f1f5f9',
      surface: '#ffffff',
      surfaceHover: '#e2e8f0',
      border: 'rgba(203, 213, 225, 0.5)',
      text: '#0f172a',
      textMuted: '#64748b',
      primary: '#38bdf8',
      secondary: '#818cf8',
      accent: '#34d399',
      glow: 'rgba(56, 189, 248, 0.2)',
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
      fontFamily: 'Inter, sans-serif',
      fontSize: 'comfortable',
      uiScale: 1.0,
    },
    layout: {
      density: 'comfortable',
      tabStyle: 'rounded',
    },
  },

  'nebula': {
    id: 'nebula',
    name: 'Nebula',
    description: 'Deep cosmic violet with radiant magenta and cyan tones.',
    category: 'cyber',
    colors: {
      bg: '#0a0518',
      bgSecondary: '#120b2a',
      surface: '#1e123a',
      surfaceHover: '#2a1a4e',
      border: 'rgba(168, 85, 247, 0.25)',
      text: '#f3e8ff',
      textMuted: '#a855f7',
      primary: '#c084fc',
      secondary: '#f43f5e',
      accent: '#22d3ee',
      glow: 'rgba(192, 132, 252, 0.3)',
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
      fontFamily: 'Inter, sans-serif',
      fontSize: 'comfortable',
      uiScale: 1.0,
    },
    layout: {
      density: 'comfortable',
      tabStyle: 'rounded',
    },
  },

  'sakura': {
    id: 'sakura',
    name: 'Sakura',
    description: 'Pastel cherry blossom pink, soft cream and warm blush.',
    category: 'pastel',
    colors: {
      bg: '#fff5f7',
      bgSecondary: '#ffe6ec',
      surface: '#ffffff',
      surfaceHover: '#ffd6e0',
      border: 'rgba(244, 114, 182, 0.3)',
      text: '#4a2032',
      textMuted: '#9f5874',
      primary: '#f472b6',
      secondary: '#fb7185',
      accent: '#fbbf24',
      glow: 'rgba(244, 114, 182, 0.25)',
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
      fontFamily: 'Inter, sans-serif',
      fontSize: 'comfortable',
      uiScale: 1.0,
    },
    layout: {
      density: 'comfortable',
      tabStyle: 'pill',
    },
  },

  'pastel-forest': {
    id: 'pastel-forest',
    name: 'Pastel Forest',
    description: 'Pistachio green, sage leaf, and warm linen.',
    category: 'pastel',
    colors: {
      bg: '#f2f7f4',
      bgSecondary: '#e1ede6',
      surface: '#ffffff',
      surfaceHover: '#d2e4d9',
      border: 'rgba(74, 124, 89, 0.25)',
      text: '#1e3323',
      textMuted: '#5a7861',
      primary: '#4a7c59',
      secondary: '#8fc0a9',
      accent: '#f8c390',
      glow: 'rgba(74, 124, 89, 0.2)',
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
      fontFamily: 'Inter, sans-serif',
      fontSize: 'comfortable',
      uiScale: 1.0,
    },
    layout: {
      density: 'comfortable',
      tabStyle: 'rounded',
    },
  },

  'ocean-glass': {
    id: 'ocean-glass',
    name: 'Ocean Glass',
    description: 'Powder aqua, deep marine blue and crisp translucent glass.',
    category: 'cyber',
    colors: {
      bg: '#04121e',
      bgSecondary: '#092133',
      surface: '#0f3148',
      surfaceHover: '#174360',
      border: 'rgba(56, 189, 248, 0.25)',
      text: '#e0f2fe',
      textMuted: '#7dd3fc',
      primary: '#38bdf8',
      secondary: '#2dd4bf',
      accent: '#a7f3d0',
      glow: 'rgba(56, 189, 248, 0.3)',
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
      fontFamily: 'Inter, sans-serif',
      fontSize: 'comfortable',
      uiScale: 1.0,
    },
    layout: {
      density: 'comfortable',
      tabStyle: 'rounded',
    },
  },

  'amoled-void': {
    id: 'amoled-void',
    name: 'AMOLED Void',
    description: 'Absolute OLED pitch black with minimal high-contrast white accents.',
    category: 'dark',
    colors: {
      bg: '#000000',
      bgSecondary: '#0a0a0a',
      surface: '#141414',
      surfaceHover: '#222222',
      border: 'rgba(255, 255, 255, 0.15)',
      text: '#ffffff',
      textMuted: '#888888',
      primary: '#ffffff',
      secondary: '#aaaaaa',
      accent: '#333333',
      glow: 'rgba(255, 255, 255, 0.1)',
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
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 'compact',
      uiScale: 1.0,
    },
    layout: {
      density: 'compact',
      tabStyle: 'minimal',
    },
  },

  'terminal': {
    id: 'terminal',
    name: 'Terminal',
    description: 'Retro hacker green phosphor on pitch black.',
    category: 'dark',
    colors: {
      bg: '#050a05',
      bgSecondary: '#0a140a',
      surface: '#0f1f0f',
      surfaceHover: '#162e16',
      border: 'rgba(34, 197, 94, 0.3)',
      text: '#4ade80',
      textMuted: '#16a34a',
      primary: '#22c55e',
      secondary: '#86efac',
      accent: '#facc15',
      glow: 'rgba(34, 197, 94, 0.3)',
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
      fontSize: 'compact',
      uiScale: 1.0,
    },
    layout: {
      density: 'compact',
      tabStyle: 'minimal',
    },
  },
};

export function applyThemeTokens(theme: ThemeTokens) {
  const root = document.documentElement;

  root.style.setProperty('--lunar-bg', theme.colors.bg);
  root.style.setProperty('--lunar-bg-secondary', theme.colors.bgSecondary);
  root.style.setProperty('--lunar-surface', theme.colors.surface);
  root.style.setProperty('--lunar-surface-hover', theme.colors.surfaceHover);
  root.style.setProperty('--lunar-border', theme.colors.border);
  root.style.setProperty('--lunar-text', theme.colors.text);
  root.style.setProperty('--lunar-text-muted', theme.colors.textMuted);
  root.style.setProperty('--lunar-primary', theme.colors.primary);
  root.style.setProperty('--lunar-secondary', theme.colors.secondary);
  root.style.setProperty('--lunar-accent', theme.colors.accent);
  root.style.setProperty('--lunar-glow', theme.colors.glow);

  root.style.setProperty('--lunar-blur', `${theme.appearance.blur}px`);
  root.style.setProperty('--lunar-radius', `${theme.appearance.cornerRadius}px`);
  root.style.setProperty('--lunar-font-family', theme.typography.fontFamily);
}

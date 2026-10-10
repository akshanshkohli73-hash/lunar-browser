import React, { useState } from 'react';
import { ThemeTokens, BUILTIN_THEMES, applyThemeTokens } from '../styles/themes';

interface ThemeStudioViewProps {
  currentTheme: ThemeTokens;
  onThemeChange: (theme: ThemeTokens) => void;
}

export const ThemeStudioView: React.FC<ThemeStudioViewProps> = ({ currentTheme, onThemeChange }) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'colors' | 'appearance' | 'layout'>('preset');
  const [theme, setTheme] = useState<ThemeTokens>(currentTheme);
  const [importError, setImportError] = useState<string>('');

  const updateColor = (key: keyof ThemeTokens['colors'], value: string) => {
    const updated: ThemeTokens = {
      ...theme,
      colors: {
        ...theme.colors,
        [key]: value,
      },
    };
    setTheme(updated);
    applyThemeTokens(updated);
    onThemeChange(updated);
  };

  const updateAppearance = (key: keyof ThemeTokens['appearance'], value: number) => {
    const updated: ThemeTokens = {
      ...theme,
      appearance: {
        ...theme.appearance,
        [key]: value,
      },
    };
    setTheme(updated);
    applyThemeTokens(updated);
    onThemeChange(updated);
  };

  const handleSelectPreset = (presetId: string) => {
    const selected = BUILTIN_THEMES[presetId];
    if (selected) {
      setTheme(selected);
      applyThemeTokens(selected);
      onThemeChange(selected);
    }
  };

  const handleExportTheme = () => {
    const jsonStr = JSON.stringify(theme, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.id || 'custom-theme'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== 'object' || !parsed.colors || !parsed.name) {
          throw new Error('Invalid theme format.');
        }

        // Strictly configuration-only validation
        const safeImport: ThemeTokens = {
          id: `custom-${Date.now()}`,
          name: String(parsed.name).substring(0, 30),
          description: String(parsed.description || 'Imported custom theme').substring(0, 100),
          category: 'dark',
          colors: {
            bg: String(parsed.colors.bg || '#050508'),
            bgSecondary: String(parsed.colors.bgSecondary || '#0d0f17'),
            surface: String(parsed.colors.surface || '#131622'),
            surfaceHover: String(parsed.colors.surfaceHover || '#1c2032'),
            border: String(parsed.colors.border || 'rgba(255,255,255,0.1)'),
            text: String(parsed.colors.text || '#ffffff'),
            textMuted: String(parsed.colors.textMuted || '#888888'),
            primary: String(parsed.colors.primary || '#00f0ff'),
            secondary: String(parsed.colors.secondary || '#8a2be2'),
            accent: String(parsed.colors.accent || '#a3e635'),
            glow: String(parsed.colors.glow || 'rgba(0,240,255,0.2)'),
          },
          appearance: {
            glassIntensity: Number(parsed.appearance?.glassIntensity) || 0.6,
            blur: Number(parsed.appearance?.blur) || 16,
            glowIntensity: Number(parsed.appearance?.glowIntensity) || 0.5,
            shadowStrength: Number(parsed.appearance?.shadowStrength) || 0.3,
            borderBrightness: Number(parsed.appearance?.borderBrightness) || 0.2,
            cornerRadius: Number(parsed.appearance?.cornerRadius) || 8,
          },
          typography: {
            fontFamily: String(parsed.typography?.fontFamily || 'Inter, sans-serif'),
            fontSize: 'comfortable',
            uiScale: 1.0,
          },
          layout: {
            density: 'comfortable',
            tabStyle: 'rounded',
          },
        };

        setTheme(safeImport);
        applyThemeTokens(safeImport);
        onThemeChange(safeImport);
      } catch (err: any) {
        setImportError(err.message || 'Error parsing theme file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[var(--lunar-bg)] text-[var(--lunar-text)]">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--lunar-border)] pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>🎨</span> Theme Studio
            </h1>
            <p className="text-xs text-[var(--lunar-text-muted)] mt-1">
              Customize visual tokens, glass effects, borders, and color palettes in real-time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="px-3 py-1.5 rounded-lg bg-[var(--lunar-surface)] border border-[var(--lunar-border)] text-xs cursor-pointer hover:bg-[var(--lunar-surface-hover)] transition">
              <span>📥 Import</span>
              <input type="file" accept=".json" onChange={handleImportTheme} className="hidden" />
            </label>
            <button
              onClick={handleExportTheme}
              className="px-3 py-1.5 rounded-lg bg-[var(--lunar-primary)] text-black font-semibold text-xs transition hover:opacity-90"
            >
              📤 Export Theme
            </button>
          </div>
        </div>

        {importError && (
          <div className="p-3 bg-red-500/20 border border-red-500/30 text-red-400 text-xs rounded-lg">
            {importError}
          </div>
        )}

        {/* SUB TABS */}
        <div className="flex gap-2 border-b border-[var(--lunar-border)] pb-2">
          {(['preset', 'colors', 'appearance', 'layout'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs rounded-lg capitalize transition ${
                activeTab === tab
                  ? 'bg-[var(--lunar-primary)] text-black font-bold'
                  : 'bg-[var(--lunar-surface)] border border-[var(--lunar-border)] text-[var(--lunar-text-muted)] hover:text-[var(--lunar-text)]'
              }`}
            >
              {tab === 'preset' ? 'Built-in Presets' : tab}
            </button>
          ))}
        </div>

        {/* PRESETS TAB */}
        {activeTab === 'preset' && (
          <div className="grid grid-cols-3 gap-4">
            {Object.values(BUILTIN_THEMES).map((preset) => (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset.id)}
                className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                  theme.id === preset.id
                    ? 'border-[var(--lunar-primary)] shadow-[0_0_15px_var(--lunar-glow)] bg-[var(--lunar-surface)]'
                    : 'border-[var(--lunar-border)] bg-[var(--lunar-surface)]/50 hover:bg-[var(--lunar-surface-hover)]'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold">{preset.name}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded uppercase font-mono bg-white/10">
                      {preset.category}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--lunar-text-muted)] mb-4">{preset.description}</p>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--lunar-border)]">
                  <div className="w-5 h-5 rounded-full border border-black/20" style={{ backgroundColor: preset.colors.bg }} />
                  <div className="w-5 h-5 rounded-full border border-black/20" style={{ backgroundColor: preset.colors.surface }} />
                  <div className="w-5 h-5 rounded-full border border-black/20" style={{ backgroundColor: preset.colors.primary }} />
                  <div className="w-5 h-5 rounded-full border border-black/20" style={{ backgroundColor: preset.colors.secondary }} />
                  <div className="w-5 h-5 rounded-full border border-black/20" style={{ backgroundColor: preset.colors.accent }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* COLORS TAB */}
        {activeTab === 'colors' && (
          <div className="grid grid-cols-2 gap-4 bg-[var(--lunar-surface)] p-6 rounded-xl border border-[var(--lunar-border)]">
            {(Object.keys(theme.colors) as Array<keyof ThemeTokens['colors']>).map((colKey) => (
              <div key={colKey} className="flex items-center justify-between p-2 border-b border-[var(--lunar-border)]">
                <span className="text-xs capitalize font-medium">{colKey}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.colors[colKey].startsWith('#') ? theme.colors[colKey] : '#00f0ff'}
                    onChange={(e) => updateColor(colKey, e.target.value)}
                    className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={theme.colors[colKey]}
                    onChange={(e) => updateColor(colKey, e.target.value)}
                    className="w-28 text-xs font-mono p-1 bg-[var(--lunar-bg)] border border-[var(--lunar-border)] rounded text-center"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* APPEARANCE TAB */}
        {activeTab === 'appearance' && (
          <div className="space-y-4 bg-[var(--lunar-surface)] p-6 rounded-xl border border-[var(--lunar-border)]">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Corner Radius ({theme.appearance.cornerRadius}px)</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                value={theme.appearance.cornerRadius}
                onChange={(e) => updateAppearance('cornerRadius', Number(e.target.value))}
                className="w-full accent-[var(--lunar-primary)]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Blur Intensity ({theme.appearance.blur}px)</span>
              </div>
              <input
                type="range"
                min="0"
                max="32"
                value={theme.appearance.blur}
                onChange={(e) => updateAppearance('blur', Number(e.target.value))}
                className="w-full accent-[var(--lunar-primary)]"
              />
            </div>
          </div>
        )}

        {/* LAYOUT TAB */}
        {activeTab === 'layout' && (
          <div className="bg-[var(--lunar-surface)] p-6 rounded-xl border border-[var(--lunar-border)] space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--lunar-text-muted)]">
              Density & Tab Styles
            </h3>
            <p className="text-xs text-[var(--lunar-text-muted)]">
              Adjust spacing density and tab rounding preferences.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeStudioView;

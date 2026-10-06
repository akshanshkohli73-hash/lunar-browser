import React, { useState, useEffect } from 'react';
import { ExtensionInfo } from '../../electron/types';

export const ExtensionsView: React.FC = () => {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (window.lunarAPI) {
      window.lunarAPI.getExtensions().then((exts: ExtensionInfo[]) => {
        if (exts) setExtensions(exts);
      });
    }
  }, []);

  const handleLoadUnpacked = async () => {
    setErrorMsg('');
    try {
      if (window.lunarAPI) {
        const ext = await window.lunarAPI.loadUnpackedExtension();
        if (ext) {
          setExtensions((prev) => [...prev, ext]);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load extension');
    }
  };

  const handleToggle = (id: string, enabled: boolean) => {
    if (window.lunarAPI) {
      window.lunarAPI.toggleExtension(id, !enabled);
      setExtensions((prev) =>
        prev.map((e) => (e.id === id ? { ...e, enabled: !enabled } : e))
      );
    }
  };

  const handleRemove = (id: string) => {
    if (window.lunarAPI) {
      window.lunarAPI.removeExtension(id);
      setExtensions((prev) => prev.filter((e) => e.id !== id));
    }
  };

  return (
    <div className="flex-1 bg-[#050508] text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span>🧩</span> LUNAR EXTENSIONS
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manage installed Chromium WebExtensions and custom extensions.
            </p>
          </div>
          <button
            onClick={handleLoadUnpacked}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-medium text-xs hover:bg-cyan-500/30 transition shadow-[0_0_15px_rgba(0,240,255,0.15)]"
          >
            + Load Unpacked Extension
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            ⚠️ {errorMsg}
          </div>
        )}

        {extensions.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
            <span className="text-3xl">🧩</span>
            <h3 className="text-sm font-semibold text-slate-300 mt-2">No Extensions Installed</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Lunar Browser supports Manifest V2 & V3 WebExtensions. Load an unpacked extension folder to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {extensions.map((ext) => (
              <div key={ext.id} className="p-4 rounded-xl bg-[#0d0f17] border border-white/10 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-100">{ext.name}</h3>
                    <span className="text-[10px] text-slate-500 font-mono">v{ext.version}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                      ext.compatibility === 'FULL'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                    }`}
                  >
                    {ext.compatibility} COMPATIBILITY
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2">{ext.description}</p>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ext.enabled}
                      onChange={() => handleToggle(ext.id, ext.enabled)}
                      className="text-cyan-500 rounded"
                    />
                    <span className="text-[11px] text-slate-300">{ext.enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                  <button
                    onClick={() => handleRemove(ext.id)}
                    className="text-[11px] text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExtensionsView;

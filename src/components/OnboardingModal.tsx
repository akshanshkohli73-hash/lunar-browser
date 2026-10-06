import React, { useState } from 'react';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [searchEngine, setSearchEngine] = useState<string>('google');
  const [aiProvider, setAiProvider] = useState<string>('openrouter');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0d0f17] border border-cyan-500/30 rounded-2xl p-8 shadow-2xl relative space-y-6">
        {/* STEP 1: WELCOME */}
        {step === 1 && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-500 via-violet-500 to-lime-400 p-[2px] mx-auto">
              <div className="w-full h-full bg-[#050508] rounded-full flex items-center justify-center text-3xl font-bold text-cyan-400">
                ☾
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                WELCOME TO LUNAR
              </h2>
              <p className="text-xs text-slate-400 mt-2">
                Your private, intelligent space for exploring the web.
              </p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold text-xs transition shadow-[0_0_20px_rgba(0,240,255,0.25)]"
            >
              Continue
            </button>
          </div>
        )}

        {/* STEP 2: SEARCH ENGINE */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200">Choose Search Engine</h3>
            <div className="space-y-2">
              {['Google', 'Bing', 'DuckDuckGo'].map((se) => (
                <label
                  key={se}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10"
                >
                  <input
                    type="radio"
                    name="search"
                    checked={searchEngine === se.toLowerCase()}
                    onChange={() => setSearchEngine(se.toLowerCase())}
                    className="text-cyan-500"
                  />
                  <span className="text-xs text-slate-200 font-medium">{se}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full py-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold"
            >
              Next
            </button>
          </div>
        )}

        {/* STEP 3: LUNAR SHIELD */}
        {step === 3 && (
          <div className="space-y-4 text-center">
            <span className="text-4xl">🛡️</span>
            <div>
              <h3 className="text-base font-bold text-cyan-400">LUNAR SHIELD</h3>
              <p className="text-xs text-slate-400 mt-1">
                Ads, trackers, cryptominers, and popups will be automatically intercepted.
              </p>
            </div>
            <button
              onClick={() => setStep(4)}
              className="w-full py-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold"
            >
              Recommended Settings
            </button>
          </div>
        )}

        {/* STEP 4: READY */}
        {step === 4 && (
          <div className="text-center space-y-4">
            <span className="text-4xl">🚀</span>
            <div>
              <h3 className="text-lg font-bold text-slate-100">READY FOR LAUNCH</h3>
              <p className="text-xs text-slate-400 mt-1">
                Everything is configured for a private and fast browsing experience.
              </p>
            </div>
            <button
              onClick={onComplete}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-violet-500 to-lime-400 text-slate-950 font-bold text-xs uppercase tracking-wider"
            >
              Start Browsing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingModal;

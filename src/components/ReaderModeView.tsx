import React from 'react';

interface ReaderModeProps {
  title: string;
  url: string;
  content: string;
  onClose: () => void;
}

export const ReaderModeView: React.FC<ReaderModeProps> = ({ title, url, content, onClose }) => {
  return (
    <div className="flex-1 bg-[#0a0c12] text-slate-200 p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              LUNAR READER MODE
            </span>
            <h1 className="text-2xl font-bold text-slate-100 mt-1">{title}</h1>
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:underline">
              {url}
            </a>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition"
          >
            Exit Reader
          </button>
        </div>

        <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap font-serif text-slate-300">
          {content || 'Reading content extracted from webpage.'}
        </div>
      </div>
    </div>
  );
};

export default ReaderModeView;

import React, { useState } from 'react';
import { AIService } from '../ai/ai-service';

interface AISidebarProps {
  onClose: () => void;
  activeTabId?: string;
}

const aiService = new AIService();

export const AISidebar: React.FC<AISidebarProps> = ({ onClose, activeTabId }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: 'Hello! I am Lunar AI. How can I assist you with this page or topic?' },
  ]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mode, setMode] = useState<'ask' | 'summarize' | 'explain' | 'notes'>('ask');

  const handleSend = async (customPrompt?: string, customMode?: any) => {
    const promptToSend = customPrompt || inputPrompt;
    if (!promptToSend.trim()) return;

    const selectedMode = customMode || mode;

    setMessages((prev) => [...prev, { role: 'user', content: promptToSend }]);
    if (!customPrompt) setInputPrompt('');
    setIsLoading(true);

    try {
      // Extract page context safely
      let pageText = '';
      if (window.lunarAPI) {
        pageText = await window.lunarAPI.getPageText(activeTabId);
      }

      const settings = window.lunarAPI ? await window.lunarAPI.getSettings() : null;
      const provider = settings?.aiProvider || 'openrouter';
      const apiKey = settings?.aiApiKey || '';

      const response = await aiService.ask(
        provider,
        {
          prompt: promptToSend,
          contextText: pageText,
          mode: selectedMode,
        },
        apiKey
      );

      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (actionLabel: string, actionMode: 'summarize' | 'explain' | 'notes') => {
    let prompt = '';
    if (actionMode === 'summarize') prompt = 'Summarize the contents of this webpage clearly.';
    else if (actionMode === 'explain') prompt = 'Explain the key concepts on this page in simple terms.';
    else if (actionMode === 'notes') prompt = 'Create structured bullet-point notes from this page.';

    setMode(actionMode);
    handleSend(prompt, actionMode);
  };

  return (
    <div className="w-80 h-full bg-[#0d0f17] border-l border-white/10 flex flex-col z-30 shadow-2xl">
      {/* HEADER */}
      <div className="h-11 px-4 border-b border-white/10 flex items-center justify-between bg-[#08090f]">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <span className="text-xs font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
            LUNAR AI
          </span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xs">
          ✕
        </button>
      </div>

      {/* QUICK MODES */}
      <div className="p-3 border-b border-white/5 bg-white/[0.02] grid grid-cols-3 gap-1.5">
        <button
          onClick={() => handleQuickAction('Summarize', 'summarize')}
          className="p-1.5 text-[11px] font-medium rounded bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 border border-white/5 transition text-center"
        >
          Summarize
        </button>
        <button
          onClick={() => handleQuickAction('Explain', 'explain')}
          className="p-1.5 text-[11px] font-medium rounded bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-300 border border-white/5 transition text-center"
        >
          Explain
        </button>
        <button
          onClick={() => handleQuickAction('Notes', 'notes')}
          className="p-1.5 text-[11px] font-medium rounded bg-white/5 hover:bg-lime-500/20 hover:text-lime-300 border border-white/5 transition text-center"
        >
          Notes
        </button>
      </div>

      {/* MESSAGES CONTAINER */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl max-w-[90%] ${
              msg.role === 'user'
                ? 'ml-auto bg-cyan-500/15 border border-cyan-500/30 text-cyan-100'
                : 'mr-auto bg-white/5 border border-white/10 text-slate-200'
            }`}
          >
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400 mb-1">
              {msg.role === 'user' ? 'You' : 'Lunar AI'}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 animate-pulse text-xs">
            Lunar AI is thinking...
          </div>
        )}
      </div>

      {/* INPUT FORM */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-white/10 bg-[#08090f] flex gap-2"
      >
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Ask Lunar AI..."
          className="flex-1 h-9 px-3 bg-[#131622] text-xs text-slate-100 placeholder-slate-500 rounded-lg border border-white/10 focus:border-violet-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default AISidebar;

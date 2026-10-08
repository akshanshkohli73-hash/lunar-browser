import React, { useState, useEffect } from 'react';

export const NotesView: React.FC = () => {
  const [note, setNote] = useState<string>(() => {
    return localStorage.getItem('lunar_quick_note') || 'Welcome to Lunar Notes 📝\n\n- Write ideas, web summaries, or research thoughts here.\n- Saved automatically locally.';
  });

  useEffect(() => {
    localStorage.setItem('lunar_quick_note', note);
  }, [note]);

  return (
    <div className="h-full w-full flex flex-col p-4 bg-[var(--lunar-bg)] text-[var(--lunar-text)]">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--lunar-border)]">
        <span className="text-xs font-semibold text-[var(--lunar-text-muted)]">TextEdit / Quick Notes</span>
        <span className="text-[10px] font-mono text-[var(--lunar-primary)]">Auto-saved</span>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Type your notes..."
        className="flex-1 w-full p-3 rounded-lg bg-[var(--lunar-surface)] border border-[var(--lunar-border)] text-xs text-[var(--lunar-text)] focus:outline-none focus:border-[var(--lunar-primary)] resize-none font-sans"
      />
    </div>
  );
};

export default NotesView;

import { useEffect, useState } from "react";
export default function NotesView() {
  const [note, setNote] = useState(() => {
    try {
      return localStorage.getItem("lunar_quick_note") ?? "";
    } catch {
      return "";
    }
  });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem("lunar_quick_note", note);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [note]);
  return (
    <section className="quick-notes">
      <header>
        <strong>Quick notes</strong>
        <small role="status">
          {saved
            ? "Saved locally"
            : "Could not save — copy your text to keep it"}
        </small>
      </header>
      <textarea
        aria-label="Quick notes"
        placeholder="A thought worth keeping…"
        value={note}
        onChange={(event) => {
          setSaved(false);
          setNote(event.target.value);
        }}
      />
    </section>
  );
}

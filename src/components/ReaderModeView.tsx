export default function ReaderModeView({
  title,
  url,
  content,
  onClose,
}: {
  title: string;
  url: string;
  content: string;
  onClose: () => void;
}) {
  return (
    <article className="reader-view internal-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Local text reader</span>
          <h1>{title}</h1>
          <p>{url}</p>
        </div>
        <button onClick={onClose}>Return to webpage</button>
      </header>
      <div className="reader-text">
        {content || "This page has no readable body text."}
      </div>
    </article>
  );
}

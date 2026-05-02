import type { FormEvent } from "react";
import { useLabStore } from "../store/lab-store";

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

export const NotesCard = () => {
  const notes = useLabStore((state) => state.notes);
  const draft = useLabStore((state) => state.draft);
  const setDraft = useLabStore((state) => state.setDraft);
  const addNote = useLabStore((state) => state.addNote);
  const removeNote = useLabStore((state) => state.removeNote);
  const clearNotes = useLabStore((state) => state.clearNotes);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addNote(draft);
  };

  return (
    <section className="lab-card">
      <header className="lab-card__header">
        <h2 className="lab-card__title">Notes</h2>
        <p className="lab-card__subtitle">A scratch list backed by the same zustand store.</p>
      </header>

      <form className="lab-notes__form" onSubmit={onSubmit}>
        <input
          className="lab-input"
          placeholder="Jot something down…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="lab-button lab-button--primary" disabled={!draft.trim()}>
          Add
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="lab-empty">No notes yet — add one above.</p>
      ) : (
        <ul className="lab-notes__list">
          {notes.map((note) => (
            <li key={note.id} className="lab-note">
              <div className="lab-note__body">
                <span className="lab-note__text">{note.text}</span>
                <span className="lab-note__meta">{formatTime(note.createdAt)}</span>
              </div>
              <button
                type="button"
                className="lab-button lab-button--ghost lab-button--small"
                onClick={() => removeNote(note.id)}
                aria-label={`Remove note ${note.text}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {notes.length > 0 ? (
        <footer className="lab-notes__footer">
          <button type="button" className="lab-button lab-button--ghost lab-button--small" onClick={clearNotes}>
            Clear all
          </button>
        </footer>
      ) : null}
    </section>
  );
};

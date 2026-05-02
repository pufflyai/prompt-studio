import { CounterCard } from "../components/counter-card";
import { NotesCard } from "../components/notes-card";
import { StatsCard } from "../components/stats-card";

export const LabPage = () => {
  return (
    <main className="lab-page">
      <header className="lab-page__header">
        <p className="lab-page__eyebrow">Extension Lab</p>
        <h1 className="lab-page__title">Sandbox webview</h1>
        <p className="lab-page__lead">
          A self-contained React + Zustand surface for trying out the extension API. Everything here lives inside the
          webview iframe and shares state through a single zustand store.
        </p>
      </header>

      <StatsCard />

      <div className="lab-page__grid">
        <CounterCard />
        <NotesCard />
      </div>
    </main>
  );
};

import { useLabStore } from "../store/lab-store";

export const StatsCard = () => {
  const counter = useLabStore((state) => state.counter);
  const noteCount = useLabStore((state) => state.notes.length);

  return (
    <section className="lab-card lab-card--stats">
      <div className="lab-stat">
        <span className="lab-stat__label">Counter</span>
        <span className="lab-stat__value">{counter}</span>
      </div>
      <div className="lab-stat">
        <span className="lab-stat__label">Notes</span>
        <span className="lab-stat__value">{noteCount}</span>
      </div>
    </section>
  );
};

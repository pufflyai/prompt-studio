import { useLabStore } from "../store/lab-store";

export const CounterCard = () => {
  const counter = useLabStore((state) => state.counter);
  const increment = useLabStore((state) => state.increment);
  const decrement = useLabStore((state) => state.decrement);
  const reset = useLabStore((state) => state.reset);

  return (
    <section className="lab-card">
      <header className="lab-card__header">
        <h2 className="lab-card__title">Counter</h2>
        <p className="lab-card__subtitle">Local zustand state, scoped to this webview session.</p>
      </header>
      <div className="lab-counter">
        <span className="lab-counter__value">{counter}</span>
        <div className="lab-counter__actions">
          <button type="button" className="lab-button" onClick={decrement} aria-label="Decrement">
            −
          </button>
          <button type="button" className="lab-button lab-button--primary" onClick={increment} aria-label="Increment">
            +1
          </button>
          <button type="button" className="lab-button lab-button--ghost" onClick={reset}>
            Reset
          </button>
        </div>
      </div>
    </section>
  );
};

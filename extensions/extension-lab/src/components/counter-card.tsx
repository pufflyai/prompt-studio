import { useEffect, useState } from "react";
import { executeCounterCommand, getProjectIdFromSearch } from "../counter-api";
import { useLabStore } from "../store/lab-store";

export const CounterCard = () => {
  const counter = useLabStore((state) => state.counter);
  const setCounter = useLabStore((state) => state.setCounter);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectId = getProjectIdFromSearch(window.location.search);

  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;

    const readCounter = async () => {
      setIsPending(true);
      setError(null);

      try {
        const next = await executeCounterCommand({ commandId: "lab.counter.read", projectId });
        if (isMounted) {
          setCounter(next);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isMounted) {
          setIsPending(false);
        }
      }
    };

    void readCounter();

    return () => {
      isMounted = false;
    };
  }, [projectId, setCounter]);

  const runCounterCommand = async (
    commandId: "lab.counter.bump" | "lab.counter.read" | "lab.counter.reset",
    params?: Record<string, unknown>,
  ) => {
    if (!projectId || isPending) return;

    setIsPending(true);
    setError(null);

    try {
      const next = await executeCounterCommand({ commandId, projectId, params });
      setCounter(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  };

  const disabled = isPending || !projectId;

  return (
    <section className="lab-card">
      <header className="lab-card__header">
        <h2 className="lab-card__title">Counter</h2>
        <p className="lab-card__subtitle">Project-scoped extension storage through ctx.storage.</p>
      </header>
      <div className="lab-counter">
        <span className="lab-counter__value">{counter}</span>
        <div className="lab-counter__actions">
          <button
            type="button"
            className="lab-button"
            onClick={() => runCounterCommand("lab.counter.bump", { amount: -1 })}
            aria-label="Decrement"
            disabled={disabled}
          >
            −
          </button>
          <button
            type="button"
            className="lab-button lab-button--primary"
            onClick={() => runCounterCommand("lab.counter.bump")}
            aria-label="Increment"
            disabled={disabled}
          >
            +1
          </button>
          <button
            type="button"
            className="lab-button lab-button--ghost"
            onClick={() => runCounterCommand("lab.counter.reset")}
            disabled={disabled}
          >
            Reset
          </button>
        </div>
        {error ? <p className="lab-card__error">{error}</p> : null}
      </div>
    </section>
  );
};

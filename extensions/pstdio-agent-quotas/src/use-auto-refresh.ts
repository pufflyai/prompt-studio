import { useEffect, useRef } from "react";

/** How often a visible view asks again. The backend answers from its saved reading until that is stale. */
export const VIEW_REFRESH_MS = 60_000;

/**
 * Quotas change outside Prompt Studio, so no event announces them. Ask again on a timer while the
 * view is visible, instead of relying on the saved-change event alone.
 */
export const useAutoRefresh = (refresh: () => void, active: boolean, intervalMs = VIEW_REFRESH_MS) => {
  // `refresh` changes on every render; re-renders must not restart the timer.
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => latest.current(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
};

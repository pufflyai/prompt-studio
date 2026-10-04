import {
  PERFORMANCE_LIMITS,
  type SlowFrame,
  type SlowFrameReport,
  type SlowFrameSource,
} from "pstdio-api-contracts/performance-diagnostics";
import { type SlowFrameEntry, toSlowFrame } from "./slow-frame-attribution";

// Batching keeps a busy renderer to at most one report per second.
const REPORT_DELAY_MS = 1_000;

const slowFrameSource = (): SlowFrameSource => {
  const supported = globalThis.PerformanceObserver?.supportedEntryTypes ?? [];
  if (supported.includes("long-animation-frame")) return "long-animation-frame";
  if (supported.includes("longtask")) return "longtask";
  return "unsupported";
};

// Observes frames of 50 ms or more in this renderer. The first report only names
// the supported entry type, so the host can explain what it can measure.
export const observeSlowFrames = (report: (report: SlowFrameReport) => void) => {
  const source = slowFrameSource();
  report({ source, frames: [] });
  if (source === "unsupported") return () => {};

  const page = { timeOrigin: performance.timeOrigin, origin: location.origin };
  let pending: SlowFrame[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    const frames = pending.slice(-PERFORMANCE_LIMITS.framesPerReport);
    pending = [];
    report({ source, frames });
  };
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) pending.push(toSlowFrame(entry as unknown as SlowFrameEntry, page));
    pending = pending.slice(-PERFORMANCE_LIMITS.framesPerReport);
    timer ??= setTimeout(flush, REPORT_DELAY_MS);
  });
  observer.observe({ type: source });

  return () => {
    observer.disconnect();
    if (timer) clearTimeout(timer);
    pending = [];
  };
};

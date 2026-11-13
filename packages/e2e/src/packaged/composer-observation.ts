import { appendFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

export type ComposerObservation = (phase: string, details?: Record<string, string | number | boolean | null>) => void;

// Keep observations outside the disposable home so cancellation and cleanup retain them.
export const createComposerObservation = (root: string) => {
  const started = performance.now();
  const directory = join(import.meta.dirname, "../../test-results/composer-observations");
  const file = join(directory, `${basename(root)}-${process.pid}.jsonl`);
  let unavailable = false;
  try {
    mkdirSync(directory, { recursive: true });
  } catch {
    unavailable = true;
    console.error("Composer observations could not create their evidence directory");
  }
  const observe: ComposerObservation = (phase, details) => {
    if (unavailable) return;
    try {
      // Small immediate records survive a whole-test cancellation before trace export.
      appendFileSync(
        file,
        `${JSON.stringify({
          sourceSha: process.env.PSTDIO_COMPOSER_SOURCE_SHA ?? null,
          home: basename(root),
          pid: process.pid,
          time: new Date().toISOString(),
          elapsedMs: performance.now() - started,
          phase,
          ...details,
        })}\n`,
      );
    } catch {
      unavailable = true;
      console.error("Composer observations could not append evidence");
    }
  };
  return observe;
};

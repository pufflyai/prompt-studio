import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import { stopChildProcess } from "../scripts/child-process";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { removeTestDirectory } from "./remove-test-directory";

// Bun can abandon a timed-out test without entering its finally block. The hook
// and the unchanged case deadline therefore share ownership of every fixture resource.
export const createComposerFixture = (allowance: number, began: number) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
  const controller = new AbortController();
  const releases = new Set<() => void>();
  let runtime: ReturnType<typeof startPackagedServe> | undefined;
  let browser: Promise<Browser> | undefined;
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      for (const release of releases) release();
      const results = await Promise.allSettled([
        browser?.then((owned) => owned.close()),
        runtime?.then(
          async (owned) => {
            // Cancellation already retires the child through its signal. Do not
            // race that physical stop with a new authenticated shutdown request.
            if (controller.signal.aborted) return stopChildProcess(owned.child);
            try {
              await stopProcess(owned.child);
            } catch (error) {
              if (!controller.signal.aborted) throw error;
              await stopChildProcess(owned.child);
            }
          },
          (error) => {
            // startPackagedServe settles its child before rejecting readiness.
            if (!controller.signal.aborted) throw error;
          },
        ),
      ]);
      try {
        await removeTestDirectory(root);
        const failed = results.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
      } finally {
        clearTimeout(deadline);
      }
    })());
  const cancel = () => {
    controller.abort(new Error("Packaged composer reached its case deadline or was cancelled"));
    return close();
  };
  const endsAt = began + allowance;
  let deadline: ReturnType<typeof setTimeout>;
  const checkDeadline = () => {
    const remaining = endsAt - performance.now();
    if (remaining > 0) {
      deadline = setTimeout(checkDeadline, remaining);
      return;
    }
    void cancel().catch((error) => console.error("Composer deadline cleanup failed", error));
  };
  deadline = setTimeout(checkDeadline, Math.max(0, endsAt - performance.now()));
  return {
    root,
    signal: controller.signal,
    start: (env: Record<string, string>) => {
      controller.signal.throwIfAborted();
      if (closing) throw new Error("Composer fixture is closing");
      runtime = startPackagedServe(root, env, undefined, undefined, undefined, controller.signal);
      return runtime;
    },
    launchBrowser: async () => {
      controller.signal.throwIfAborted();
      if (closing) throw new Error("Composer fixture is closing");
      browser = chromium.launch(PACKAGED_DASHBOARD_BROWSER);
      const owned = await browser;
      // A launch already in flight remains owned when the deadline closes admission.
      controller.signal.throwIfAborted();
      return owned;
    },
    signIn: async (page: Page, path: string) => {
      controller.signal.throwIfAborted();
      if (!runtime || closing) throw new Error("Composer runtime is unavailable");
      const owned = await runtime;
      controller.signal.throwIfAborted();
      await signInBrowser(page, owned.descriptor, path);
    },
    hold: () => {
      controller.signal.throwIfAborted();
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      releases.add(release);
      return { pending, release };
    },
    close,
    cancel,
  };
};

export type ComposerFixture = ReturnType<typeof createComposerFixture>;

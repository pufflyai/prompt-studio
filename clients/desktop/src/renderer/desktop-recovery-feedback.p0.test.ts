import { expect, test } from "bun:test";
import type { DesktopState } from "../lifecycle/lifecycle-machine";
import { createDesktopRecoveryFeedback, observeDesktopStartupState } from "./desktop-recovery-feedback";

test("retry stays pending through one IPC call while logs remain usable", async () => {
  const tracker = createDesktopRecoveryFeedback();
  const release = Promise.withResolvers<void>();
  let retries = 0;
  let openedLogs = false;
  const retry = () => {
    retries += 1;
    return release.promise;
  };
  const first = tracker.run("retry", retry);
  expect(tracker.snapshot().get("retry")).toBe("pending");
  await tracker.run("retry", retry);
  await tracker.run("open_logs", async () => {
    openedLogs = true;
  });
  expect(retries).toBe(1);
  expect(openedLogs).toBe(true);
  expect(tracker.snapshot().get("retry")).toBe("pending");
  release.reject(new Error("IPC unavailable"));
  await first;
  expect(tracker.snapshot().get("retry")).toBe("failed");
  await tracker.run("retry", async () => {});
  expect(tracker.snapshot().size).toBe(0);
});

test("late initial desktop state cannot rewind a newer native transition", async () => {
  const initial = Promise.withResolvers<DesktopState>();
  const accepted: DesktopState[] = [];
  let notify = (_state: DesktopState) => {};
  const stop = observeDesktopStartupState(
    {
      onStartupState(listener) {
        notify = listener;
        return () => {};
      },
      getStartupState: () => initial.promise,
    },
    (state) => accepted.push(state),
  );
  notify({ kind: "closing" });
  initial.resolve({ kind: "starting", phase: "database" });
  await Promise.resolve();
  expect(accepted).toEqual([{ kind: "closing" }]);
  stop();
  notify({ kind: "starting", phase: "database" });
  expect(accepted).toEqual([{ kind: "closing" }]);
});

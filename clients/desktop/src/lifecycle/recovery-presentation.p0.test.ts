import { expect, test } from "bun:test";
import type { DesktopRecoveryError } from "./lifecycle-machine";
import { createRecoveryPresentation, type NativeRecoveryAction } from "./recovery-presentation";

const failure: DesktopRecoveryError = {
  code: "workbench_unavailable",
  message: "Interface unavailable",
  actions: ["retry", "open_logs", "quit"],
};

test("a native Retry answered during shutdown cannot restart the runtime", async () => {
  const answer = Promise.withResolvers<NativeRecoveryAction>();
  let quitting = false;
  let retries = 0;
  const show = createRecoveryPresentation({
    showLifecycle: async () => {
      throw new Error("Preload failed");
    },
    showNative: () => answer.promise,
    openLogs() {},
    retry: () => {
      retries++;
    },
    quit: async () => {},
    isQuitting: () => quitting,
  });
  const pending = show(failure);
  await Promise.resolve();
  quitting = true;
  answer.resolve("retry");
  await pending;
  expect(retries).toBe(0);
});

test("working recovery keeps its controls in the desktop renderer", async () => {
  let native = 0;
  const show = createRecoveryPresentation({
    showLifecycle: async () => {},
    showNative: async () => {
      native++;
      return "quit";
    },
    openLogs() {},
    retry() {},
    quit: async () => {},
    isQuitting: () => false,
  });
  await show(failure);
  expect(native).toBe(0);
});

test("a broken recovery bridge still offers logs, guarded quit and manual Retry", async () => {
  const actions: NativeRecoveryAction[] = ["open_logs", "quit", "retry"];
  let logs = 0;
  let quit = 0;
  let retries = 0;
  const show = createRecoveryPresentation({
    showLifecycle: async () => {
      throw new Error("Bridge failed");
    },
    showNative: async () => actions.shift()!,
    openLogs: () => {
      logs++;
    },
    retry: () => {
      retries++;
    },
    // Active work can keep the app open; the native controls must remain available.
    quit: async () => {
      quit++;
    },
    isQuitting: () => false,
  });
  await show(failure);
  expect({ logs, quit, retries }).toEqual({ logs: 1, quit: 1, retries: 1 });
  expect(actions).toEqual([]);
});

test("concurrent failures share one native recovery and its next prompt uses the latest diagnosis", async () => {
  const prompts: {
    error: DesktopRecoveryError;
    answer: ReturnType<typeof Promise.withResolvers<NativeRecoveryAction>>;
  }[] = [];
  let retries = 0;
  const show = createRecoveryPresentation({
    showLifecycle: async () => {
      throw new Error("Bridge failed");
    },
    showNative: (error) => {
      const answer = Promise.withResolvers<NativeRecoveryAction>();
      prompts.push({ error, answer });
      return answer.promise;
    },
    openLogs() {},
    retry: () => {
      retries++;
    },
    quit: async () => {},
    isQuitting: () => false,
  });
  const first = show(failure);
  await Promise.resolve();
  const latest = { ...failure, message: "A specific runtime diagnosis" };
  const second = show(latest);
  await Promise.resolve();
  expect(prompts).toHaveLength(1);
  prompts[0]!.answer.resolve("open_logs");
  await Promise.resolve();
  expect(prompts).toHaveLength(2);
  expect(prompts[1]!.error).toBe(latest);
  prompts[1]!.answer.resolve("retry");
  await Promise.all([first, second]);
  expect(retries).toBe(1);
});

test("Retry can immediately present another failure without joining its dismissed native dialog", async () => {
  const prompts: ReturnType<typeof Promise.withResolvers<NativeRecoveryAction>>[] = [];
  let next: Promise<void> | undefined;
  let quitting = false;
  const show = createRecoveryPresentation({
    showLifecycle: async () => {
      throw new Error("Bridge still unavailable");
    },
    showNative: () => {
      const answer = Promise.withResolvers<NativeRecoveryAction>();
      prompts.push(answer);
      return answer.promise;
    },
    openLogs() {},
    retry: () => {
      next = show(failure);
    },
    quit: async () => {
      quitting = true;
    },
    isQuitting: () => quitting,
  });
  const first = show(failure);
  await Promise.resolve();
  prompts[0]!.resolve("retry");
  await first;
  await Promise.resolve();
  expect(prompts).toHaveLength(2);
  const repeated = show(failure);
  await Promise.resolve();
  expect(prompts).toHaveLength(2);
  prompts[1]!.resolve("quit");
  await Promise.all([next, repeated]);
});

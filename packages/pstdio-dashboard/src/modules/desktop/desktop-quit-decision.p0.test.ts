import { expect, test } from "bun:test";
import type { DesktopLifecycleBridge, DesktopLifecycleState } from "@/lib/desktop-lifecycle-bridge";
import { getDesktopQuitDecision } from "./desktop-quit-decision";

const activity = { sessions: [], terminals: [{ id: "term", label: "Terminal" }], jobs: [] };
const confirmation = { kind: "confirming_active_work", activity };

const fixture = () => {
  let state: DesktopLifecycleState = confirmation;
  let listener: ((state: DesktopLifecycleState) => void) | undefined;
  const confirm = Promise.withResolvers<void>();
  const startup = Promise.withResolvers<DesktopLifecycleState>();
  let reads = 0;
  const choices: string[] = [];
  const bridge: DesktopLifecycleBridge = {
    getStartupState: () => (++reads === 1 ? startup.promise : Promise.resolve(state)),
    onStartupState: (receive) => {
      listener = receive;
      return () => {
        listener = undefined;
      };
    },
    cancelQuit: async () => {
      choices.push("keep-open");
    },
    confirmQuit: () => {
      choices.push("quit");
      return confirm.promise;
    },
    setStartupAppearance: async () => {},
  };
  return {
    bridge,
    startup,
    confirm,
    choices,
    broadcast(next: DesktopLifecycleState) {
      state = next;
      listener?.(next);
    },
  };
};

test("shows a pending native choice immediately across shared views without a second IPC", async () => {
  const f = fixture();
  const dialog = getDesktopQuitDecision(f.bridge);
  const second = getDesktopQuitDecision(f.bridge);
  const stop = dialog.subscribe(() => {});
  f.broadcast(confirmation);
  f.startup.resolve({ kind: "workbench" });
  await Promise.resolve();
  expect(dialog.read().activity).toEqual(activity);

  const quit = dialog.choose("quit");
  expect(second.read()).toMatchObject({ activity, pending: "quit" });
  await second.choose("keep-open");
  expect(f.choices).toEqual(["quit"]);
  f.broadcast({ kind: "closing" });
  f.confirm.resolve();
  await quit;
  expect(dialog.read()).toEqual({ activity: null });
  stop();
});

test("a failed IPC checks native state without repeating the destructive request", async () => {
  const f = fixture();
  const dialog = getDesktopQuitDecision(f.bridge);
  const stop = dialog.subscribe(() => {});
  f.broadcast(confirmation);
  f.startup.resolve(confirmation);
  const quit = dialog.choose("quit");
  f.confirm.reject(new Error("The connection closed"));
  await quit;
  expect(dialog.read()).toMatchObject({ activity, error: "The connection closed" });
  expect(dialog.read().pending).toBeUndefined();
  expect(f.choices).toEqual(["quit"]);
  stop();
});

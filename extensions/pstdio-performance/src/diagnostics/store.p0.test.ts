import { expect, test } from "bun:test";
import { createDiagnosticsStore, type DiagnosticsClient } from "./store";
import type { DiagnosticView } from "./types";

test("subscribes only while visible and ignores a late response after disposal", async () => {
  let resolve: ((captures: DiagnosticView[]) => void) | undefined;
  let disposed = 0;
  const client = {
    commands: {
      "diagnostics.list": () =>
        new Promise<DiagnosticView[]>((done) => {
          resolve = done;
        }),
    },
    events: {
      subscribe: () => () => {
        disposed++;
      },
    },
  } as unknown as DiagnosticsClient;
  const store = createDiagnosticsStore(client);
  const stop = store.subscribe(() => {});
  stop();
  resolve?.([]);
  await Promise.resolve();
  expect(disposed).toBe(2);
  expect(store.get().loading).toBe(true);
});

test("a failed history read preserves the previous captures and shows its error", async () => {
  const capture = { id: "capture-1", status: "failed", hasResult: false } as DiagnosticView;
  let fail = false;
  const client = {
    commands: {
      "diagnostics.list": async () => {
        if (fail) throw new Error("Runtime disconnected");
        return [capture];
      },
    },
    events: { subscribe: () => () => {} },
  } as unknown as DiagnosticsClient;
  const store = createDiagnosticsStore(client);
  const stop = store.subscribe(() => {});
  await store.refresh();
  fail = true;
  await store.refresh();
  expect(store.get().captures).toEqual([capture]);
  expect(store.get().error).toContain("Runtime disconnected");
  stop();
});

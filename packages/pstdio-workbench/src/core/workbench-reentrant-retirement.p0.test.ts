import { expect, test } from "bun:test";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbenchEditingSessionAdapter } from "../extensions/bridge/webview-editing-adapter";
import { createMemoryWorkbenchPageLocationBrowser } from "./controllers/page-location/page-location-memory";
import { createWorkbench } from "./workbench-core";
import { disposeWorkbenchRequiredWork, registerWorkbenchRequiredWork } from "./workbench-required-work";

test("reentrant native cleanup joins the core's required-work barrier before any owner is released", async () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  let core: ReturnType<typeof createWorkbench>;
  let nested: Promise<void> | undefined;
  core = createWorkbench({
    pageLocationBrowser: {
      ...memory,
      onPopState(listener) {
        const subscription = memory.onPopState(listener);
        return {
          dispose() {
            subscription.dispose();
            nested = core.dispose();
          },
        };
      },
    },
  });
  const gate = Promise.withResolvers<void>();
  let requiredDone = false;
  let released = false;
  registerWorkbenchRequiredWork(core, async () => {
    await gate.promise;
    requiredDone = true;
  });
  core.registerModule({
    id: "test.required-owner",
    activate: () => ({
      dispose() {
        released = true;
      },
    }),
  });
  let finished = false;
  const outer = core.dispose();
  void outer.then(() => {
    finished = true;
  });
  await Bun.sleep(0);
  try {
    expect([finished, released, requiredDone]).toEqual([false, false, false]);
    expect(nested).toBe(outer);
  } finally {
    gate.resolve();
    await Promise.all([outer, nested]);
  }
  expect([finished, released, requiredDone]).toEqual([true, true, true]);
});

test("duplicate required-work retirement awaits the same accepted drain", async () => {
  const core = createWorkbench();
  const gate = Promise.withResolvers<void>();
  registerWorkbenchRequiredWork(core, () => gate.promise);
  const first = disposeWorkbenchRequiredWork(core);
  let complete = false;
  const second = disposeWorkbenchRequiredWork(core).then(() => {
    complete = true;
  });
  await Bun.sleep(0);
  try {
    expect(complete).toBe(false);
  } finally {
    gate.resolve();
    await Promise.all([first, second, core.dispose()]);
  }
});

test("native teardown cannot admit another structured edit after core retirement starts", async () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  let late = () => {};
  const core = createWorkbench({
    pageLocationBrowser: {
      ...memory,
      onPopState(listener) {
        const subscription = memory.onPopState(listener);
        return {
          dispose() {
            subscription.dispose();
            late();
          },
        };
      },
    },
  });
  const hostEvents = createHostEventPublisher();
  hostEvents.bind(() => {});
  const adapter = createWorkbenchEditingSessionAdapter({
    workbench: core,
    hostEvents,
    projectId: "project",
    extensionId: "example.editor",
  })!;
  let writes = 0;
  const execute = async () => {
    writes++;
  };
  await adapter.request(
    {
      operation: "open",
      sessionId: "editor",
      key: "document",
      initial: { title: "Before" },
      save: { commandId: "example.editor.command.save" },
    },
    execute,
  );
  let outcome: Promise<unknown> | undefined;
  late = () => {
    outcome = adapter
      .request(
        { operation: "commit", sessionId: "editor", sequence: 1, changes: [{ path: ["title"], value: "Late" }] },
        execute,
      )
      .catch((error) => error);
  };
  await core.dispose();
  expect(await outcome).toMatchObject({ message: "editing_session_closed" });
  expect(writes).toBe(0);
});

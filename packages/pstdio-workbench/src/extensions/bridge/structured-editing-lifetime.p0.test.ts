import { expect, test } from "bun:test";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench } from "../../core";
import { harness, navigate, openFile } from "../../core/controllers/composition/placement-lifecycle-test-support";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

test("core retirement drains accepted structured edits before releasing their command owner", async () => {
  const core = createWorkbench();
  core.pageLocations.setProject("project");
  const writing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let moduleReleased = false;
  let finished = false;
  core.registerModule({
    id: "test.structured-editing",
    activate(ctx) {
      ctx.commands.registerCommand(
        { id: "example.editor.command.save", label: "Save" },
        {
          execute: async () => {
            writing.resolve();
            await release.promise;
            finished = true;
          },
        },
      );
      return {
        dispose() {
          moduleReleased = true;
        },
      };
    },
  });
  const hostEvents = createHostEventPublisher();
  hostEvents.bind(() => {});
  const gate = createHostCapabilityGate({
    capabilities: createWorkbenchWebviewHostCapabilities({
      workbench: core,
      projectId: "project",
      extensionId: "example.editor",
      hostEvents,
    }),
    declaredCapabilities: ["editing.session"],
  });
  const call = (params: object) => gate.call({ method: "editing.session", params });
  await call({
    operation: "open",
    sessionId: "editor",
    key: "document",
    initial: { title: "Before" },
    save: { commandId: "example.editor.command.save" },
  });
  const saved = call({
    operation: "commit",
    sessionId: "editor",
    sequence: 1,
    changes: [{ path: ["title"], value: "After" }],
  });
  await writing.promise;
  let retired = false;
  const retirement = core.dispose().then(() => {
    retired = true;
  });
  await Bun.sleep(0);
  try {
    expect(retired).toBe(false);
    expect(moduleReleased).toBe(false);
    await expect(call({ operation: "preview", sessionId: "editor", sequence: 2, changes: [] })).rejects.toThrow(
      "closed",
    );
  } finally {
    release.resolve();
    await Promise.all([saved, retirement]);
  }
  expect([finished, retired, moduleReleased]).toEqual([true, true, true]);
});

test.each(["core", "placement"])("accepted structured edits can retry after their %s retires", async (retirement) => {
  const core = harness();
  await core.navigation.openTarget(navigate("workspace"));
  await core.navigation.openTarget(openFile("document"));
  const placement = core.layout.getActivePanel("main")!;
  let attempts = 0;
  core.commands.registerCommand(
    { id: "example.editor.command.save", label: "Save" },
    {
      execute: async () => {
        if (++attempts === 1) throw new Error("transient failure");
      },
    },
  );
  const hostEvents = createHostEventPublisher();
  hostEvents.bind(() => {});
  const gate = createHostCapabilityGate({
    capabilities: createWorkbenchWebviewHostCapabilities({
      workbench: core,
      projectId: "project",
      extensionId: "example.editor",
      placement,
      hostEvents,
    }),
    declaredCapabilities: ["editing.session"],
  });
  const call = (params: object) => gate.call({ method: "editing.session", params });
  await call({
    operation: "open",
    sessionId: "editor",
    key: "document",
    initial: { title: "Before" },
    save: { commandId: "example.editor.command.save" },
  });
  await expect(
    call({ operation: "commit", sessionId: "editor", sequence: 1, changes: [{ path: ["title"], value: "After" }] }),
  ).rejects.toThrow("transient failure");
  if (retirement === "placement") {
    core.closePlacement(placement.placementIdentity!);
    await expect(call({ operation: "preview", sessionId: "editor", sequence: 2, changes: [] })).rejects.toThrow(
      "no longer open",
    );
  }
  await core.dispose();
  expect(attempts).toBe(2);
});

test("editing admission without a placement keeps the captured project boundary", async () => {
  const core = createWorkbench();
  core.pageLocations.setProject("a");
  const hostEvents = createHostEventPublisher();
  hostEvents.bind(() => {});
  let writes = 0;
  const gate = createHostCapabilityGate({
    capabilities: createWorkbenchWebviewHostCapabilities({
      workbench: core,
      projectId: "a",
      extensionId: "example.editor",
      hostEvents,
      executeCommand: async () => {
        writes++;
        return { outcome: { ok: true, status: "success", value: null } };
      },
    }),
    declaredCapabilities: ["editing.session"],
  });
  const call = (params: object) => gate.call({ method: "editing.session", params });
  await call({
    operation: "open",
    sessionId: "editor",
    key: "document",
    initial: { title: "Before" },
    save: { commandId: "example.editor.command.save" },
  });
  core.pageLocations.setProject("b");
  await expect(
    call({ operation: "commit", sessionId: "editor", sequence: 1, changes: [{ path: ["title"], value: "Late" }] }),
  ).rejects.toThrow("another project");
  expect(writes).toBe(0);
  await core.dispose();
});

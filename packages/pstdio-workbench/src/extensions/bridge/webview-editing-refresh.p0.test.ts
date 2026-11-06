import { expect, test } from "bun:test";
import type { WebviewEditingSnapshot } from "pstdio-api-contracts/extension-kernel";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

test("saving an unchanged view preserves another view's backend refresh", async () => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("project");
  const writes: unknown[] = [];
  workbench.commands.registerCommand(
    { id: "pstdio.lab.command.save", label: "Save" },
    {
      execute: async (params) => {
        writes.push(params);
      },
    },
  );
  const frame = () => {
    const hostEvents = createHostEventPublisher();
    hostEvents.bind(() => {});
    const capabilities = createWorkbenchWebviewHostCapabilities({
      workbench,
      projectId: "project",
      extensionId: "pstdio.lab",
      hostEvents,
    });
    const gate = createHostCapabilityGate({ capabilities, declaredCapabilities: ["editing.session"] });
    return (params: object) => gate.call({ method: "editing.session", params });
  };
  const first = frame();
  const second = frame();
  const open = (sessionId: string) => ({
    operation: "open",
    sessionId,
    key: "pages",
    initial: { pages: ["Existing page"] },
    save: { commandId: "pstdio.lab.command.save" },
  });
  await first(open("first"));
  await second(open("second"));
  try {
    const reading = (await first({ operation: "save", sessionId: "first" })) as WebviewEditingSnapshot;
    // A second clean view requests a save while the first reads newly created data.
    await second({ operation: "save", sessionId: "second" });
    const refreshed = await first({
      operation: "refresh",
      sessionId: "first",
      expectedVersion: reading.version,
      value: { pages: ["Existing page", "New page"] },
    });
    expect(refreshed).toMatchObject({ value: { pages: ["Existing page", "New page"] } });
    expect(writes).toHaveLength(0);
  } finally {
    await first({ operation: "close", sessionId: "first" });
    await second({ operation: "close", sessionId: "second" });
  }
});

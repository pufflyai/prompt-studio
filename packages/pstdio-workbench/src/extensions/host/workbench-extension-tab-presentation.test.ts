import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchPanelInstance } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import type { RegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";
import { createWorkbenchExtensionTabPresentation } from "./workbench-extension-tab-presentation";

test("refreshes canonical resource context without moving or rebinding the tab", async () => {
  let refresh!: (event: { id: string }) => void;
  let context: import("@pstdio/sdk/extensions").ResourceContext = { type: "workspace", id: "w2", label: "Workspace 2" };
  const tab = createWorkbenchExtensionTabPresentation(
    {
      workbench: createWorkbench(),
      projectId: "p1",
      metadata: emptyWorkbenchExtensionMetadata,
      executeCommand: () => ({ context }),
      subscribeRefreshEvents: (listener) => {
        refresh = listener;
        return { dispose() {} };
      },
    },
    {
      extensionId: "test",
      placementId: "session",
      queryHandlerId: "session.context",
      refreshEventIds: ["test.changed"],
    },
  );
  const instance: WorkbenchPanelInstance = {
    instanceId: "s1",
    panelId: "session",
    closable: true,
    resource: { type: "session", id: "s1" },
  };
  let notified = Promise.withResolvers<void>();
  const subscription = tab.subscribe!(() => notified.resolve());
  tab.getSnapshot(instance);
  await notified.promise;
  expect(tab.getSnapshot(instance).context).toEqual(context);
  await new Promise<void>((resolve) => setImmediate(resolve));
  context = { type: "project", id: "p1", label: "Project" };
  notified = Promise.withResolvers<void>();
  refresh({ id: "test.changed" });
  await notified.promise;
  expect(tab.getSnapshot(instance).context).toEqual(context);
  expect(instance.resource).toEqual({ type: "session", id: "s1" });
  if (typeof subscription === "function") subscription();
  else subscription.dispose();
});

test("keeps the loaded tab title and actions while an autosave refresh is pending", async () => {
  const requests: Array<ReturnType<typeof Promise.withResolvers<unknown>>> = [];
  let refresh!: (event: { id: string }) => void;
  const input: RegisterWorkbenchExtensionContributionsInput = {
    workbench: createWorkbench(),
    projectId: "project",
    metadata: emptyWorkbenchExtensionMetadata,
    executeCommand: () => {
      const request = Promise.withResolvers<unknown>();
      requests.push(request);
      return request.promise;
    },
    subscribeRefreshEvents: (listener: typeof refresh) => {
      refresh = listener;
      return { dispose() {} };
    },
  };
  const tab = createWorkbenchExtensionTabPresentation(input, {
    extensionId: "notes",
    placementId: "note",
    queryHandlerId: "note.title",
    refreshEventIds: ["notes.changed"],
  });
  const instance: WorkbenchPanelInstance = {
    instanceId: "one",
    panelId: "note",
    closable: true,
    resource: { type: "note", id: "one", label: "New note" },
  };
  const updates: Array<ReturnType<typeof Promise.withResolvers<void>>> = [];
  const subscription = tab.subscribe!(() => updates.shift()?.resolve());
  const first = Promise.withResolvers<void>();
  updates.push(first);
  tab.getSnapshot(instance);
  requests[0].resolve({ label: "Renamed note", menu: [{ id: "note", rows: [{ id: "delete", label: "Delete" }] }] });
  await first.promise;
  await new Promise<void>((resolve) => setImmediate(resolve));
  const saved = tab.getSnapshot(instance);
  refresh({ id: "notes.changed" });
  expect(tab.getSnapshot(instance)).toBe(saved);
  const next = Promise.withResolvers<void>();
  updates.push(next);
  requests[1].resolve({ label: "Renamed note", menu: [{ id: "note", rows: [{ id: "delete", label: "Delete" }] }] });
  await next.promise;
  expect(tab.getSnapshot(instance).label).toBe("Renamed note");
  if (typeof subscription === "function") subscription();
  else subscription.dispose();
});

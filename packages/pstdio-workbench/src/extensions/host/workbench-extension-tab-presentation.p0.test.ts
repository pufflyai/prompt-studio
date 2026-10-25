import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchPanelInstance } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import type { RegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";
import { createWorkbenchExtensionTabPresentation } from "./workbench-extension-tab-presentation";

test("a reused viewer queries its new resource and rejects an old resource's late tab presentation", async () => {
  const requests: Array<ReturnType<typeof Promise.withResolvers<unknown>>> = [];
  const tab = createWorkbenchExtensionTabPresentation(
    {
      workbench: createWorkbench(),
      projectId: "project",
      metadata: emptyWorkbenchExtensionMetadata,
      executeCommand: () => {
        const pending = Promise.withResolvers<unknown>();
        requests.push(pending);
        return pending.promise;
      },
    },
    { extensionId: "notes", placementId: "reader", queryHandlerId: "title" },
  );
  const first: WorkbenchPanelInstance = {
    instanceId: "viewer",
    panelId: "reader",
    closable: true,
    resource: { type: "note", id: "a" },
  };
  const second = { ...first, resource: { type: "note", id: "b" } };
  tab.getSnapshot(first);
  tab.getSnapshot(second);
  expect(requests).toHaveLength(2);
  requests[1].resolve({ label: "B" });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(tab.getSnapshot(second).label).toBe("B");
  requests[0].resolve({ label: "A" });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(tab.getSnapshot(second).label).toBe("B");
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

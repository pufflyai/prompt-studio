import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchPanelInstance } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import type { RegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";
import { createWorkbenchExtensionTabPresentation } from "./workbench-extension-tab-presentation";

test("a storage reset refreshes the current tab title without a named extension event", async () => {
  let label = "Original note";
  let reset: (() => void) | undefined;
  const tab = createWorkbenchExtensionTabPresentation(
    {
      workbench: createWorkbench(),
      projectId: "project",
      metadata: emptyWorkbenchExtensionMetadata,
      executeCommand: async () => ({ label }),
      subscribeRefreshReset: (listener) => {
        reset = listener;
        return { dispose() {} };
      },
    },
    { extensionId: "notes", placementId: "note", queryHandlerId: "note.title", refreshEventIds: ["notes.changed"] },
  );
  const instance: WorkbenchPanelInstance = {
    instanceId: "one",
    panelId: "note",
    closable: true,
    resource: { type: "note", id: "one", label: "Original note" },
  };
  const changes: Array<() => void> = [];
  const subscription = tab.subscribe!(() => changes.shift()?.());
  const loaded = Promise.withResolvers<void>();
  changes.push(loaded.resolve);
  tab.getSnapshot(instance);
  await loaded.promise;
  expect(tab.getSnapshot(instance).label).toBe("Original note");
  label = "Renamed note";
  const refreshed = Promise.withResolvers<void>();
  changes.push(refreshed.resolve);
  try {
    expect(reset).toBeFunction();
    reset!();
    await refreshed.promise;
    expect(tab.getSnapshot(instance).label).toBe("Renamed note");
  } finally {
    if (typeof subscription === "function") subscription();
    else subscription.dispose();
  }
});

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
  const refreshedRead = Promise.withResolvers<void>();
  let refresh!: (event: { id: string }) => void;
  const input: RegisterWorkbenchExtensionContributionsInput = {
    workbench: createWorkbench(),
    projectId: "project",
    metadata: emptyWorkbenchExtensionMetadata,
    executeCommand: () => {
      const request = Promise.withResolvers<unknown>();
      requests.push(request);
      if (requests.length === 2) refreshedRead.resolve();
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
  await refreshedRead.promise;
  requests[1].resolve({ label: "Renamed note", menu: [{ id: "note", rows: [{ id: "delete", label: "Delete" }] }] });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(tab.getSnapshot(instance)).toBe(saved);
  expect(tab.getSnapshot(instance).label).toBe("Renamed note");
  if (typeof subscription === "function") subscription();
  else subscription.dispose();
});

test("tab readers share one upstream owner and only read the changed resource", async () => {
  const workbench = createWorkbench();
  const reads: string[] = [];
  const tab = createWorkbenchExtensionTabPresentation(
    {
      workbench,
      projectId: "project",
      metadata: emptyWorkbenchExtensionMetadata,
      executeCommand: async (_id, input) => {
        const resource = input.resource!;
        reads.push(resource.id);
        return { label: resource.id };
      },
    },
    { extensionId: "notes", placementId: "note", queryHandlerId: "title" },
  );
  const instance = (id: string): WorkbenchPanelInstance => ({
    instanceId: id,
    panelId: "note",
    closable: true,
    resource: { type: "note", id },
  });
  const a = instance("a");
  const b = instance("b");
  const one = tab.subscribe!(() => {});
  const two = tab.subscribe!(() => {});
  tab.getSnapshot(a);
  tab.getSnapshot(b);
  await new Promise<void>((resolve) => setImmediate(resolve));
  reads.length = 0;
  await workbench.resources.preview.begin(a.resource!, { label: "Updated" }).commit();
  expect(reads).toEqual(["a"]);
  for (const dispose of [one, two]) {
    if (typeof dispose === "function") dispose();
    else dispose.dispose();
  }
});

test("closing a tab releases its active query while the other resource remains subscribed", async () => {
  let refresh!: (event: import("./workbench-extension-refresh").WorkbenchExtensionRefreshEvent) => void;
  const reads: string[] = [];
  const tab = createWorkbenchExtensionTabPresentation(
    {
      workbench: createWorkbench(),
      projectId: "project",
      metadata: emptyWorkbenchExtensionMetadata,
      executeCommand: async (_id, body) => {
        reads.push(body.resource!.id);
        return { label: body.resource!.id };
      },
      subscribeRefreshEvents: (listener) => {
        refresh = listener;
        return { dispose() {} };
      },
    },
    { extensionId: "notes", placementId: "note", queryHandlerId: "title", refreshEventIds: ["notes.changed"] },
  );
  const a: WorkbenchPanelInstance = {
    instanceId: "a",
    panelId: "note",
    closable: true,
    resource: { type: "note", id: "a" },
  };
  const b = { ...a, instanceId: "b", resource: { type: "note", id: "b" } };
  const stopA = tab.subscribe!(() => {}, a);
  const stopB = tab.subscribe!(() => {}, b);
  tab.getSnapshot(a);
  tab.getSnapshot(b);
  await new Promise<void>((resolve) => setImmediate(resolve));
  if (typeof stopB === "function") stopB();
  else stopB.dispose();
  reads.length = 0;
  refresh({ id: "notes.changed", resourceIds: ["b"] });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(reads).toEqual([]);
  refresh({ id: "notes.changed", resourceIds: ["a"] });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(reads).toEqual(["a"]);
  if (typeof stopA === "function") stopA();
  else stopA.dispose();
});

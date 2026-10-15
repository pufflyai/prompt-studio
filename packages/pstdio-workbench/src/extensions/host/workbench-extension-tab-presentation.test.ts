import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchPanelInstance } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import type { RegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";
import { createWorkbenchExtensionTabPresentation } from "./workbench-extension-tab-presentation";

test("extension menu sections retain labels and load pages with their own resource", async () => {
  const calls: Array<{ id: string; body: unknown }> = [];
  const workbench = createWorkbench();
  const input: RegisterWorkbenchExtensionContributionsInput = {
    workbench,
    projectId: "project",
    metadata: emptyWorkbenchExtensionMetadata,
    executeCommand: async (id, body) => {
      calls.push({ id, body });
      if (id === "tabs")
        return {
          menu: [
            {
              id: "quick",
              label: "Quick access",
              rows: [],
              list: { command: { kind: "command", id: "search" }, searchLabel: "Search", emptyLabel: "Empty" },
            },
          ],
        };
      return { rows: [{ id: "one", label: "Found" }], nextCursor: "next" };
    },
  };
  const tab = createWorkbenchExtensionTabPresentation(input, {
    extensionId: "notes",
    placementId: "note",
    queryHandlerId: "tabs",
  });
  const resource = { type: "note", id: "b" };
  const instance = { instanceId: "b", panelId: "note", closable: true, resource };
  const loaded = Promise.withResolvers<void>();
  const subscription = tab.subscribe!(() => loaded.resolve());
  tab.getSnapshot(instance);
  await loaded.promise;
  const section = tab.getSnapshot(instance).menu?.[0];
  expect(section?.label).toBe("Quick access");
  const page = await section?.list?.loadPage({ query: "query", cursor: "prior", signal: new AbortController().signal });
  expect(page?.rows.map((row) => row.label)).toEqual(["Found"]);
  expect(page?.nextCursor).toBe("next");
  expect(calls.at(-1)).toMatchObject({
    id: "notes.command.search",
    body: { resource, params: { query: "query", cursor: "prior" } },
  });
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

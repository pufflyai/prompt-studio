import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { publishExtensionEvent, publishExtensionEventReset } from "@/shared/extensions/extension-webview-broadcast";
import { createResourceLinksService } from "./module";

test("refreshes for owner data changes and ignores resolver command lifecycle events", () => {
  const ctx = createWorkbench();
  ctx.commandPaletteResources.registerProvider({
    id: "notes",
    title: "Notes",
    refreshEventIds: ["notes.changed"],
    query: async () => [],
  });
  const service = createResourceLinksService(ctx as WorkbenchModuleContext, {
    type: "workspace",
    id: "w",
    projectId: "project",
    extensionId: "pstdio",
  });
  let reads = 0;
  const dispose = service.subscribe(() => reads++);
  publishExtensionEvent({ id: "command.started:notes.command.resolve-many", projectId: "project" });
  expect(reads).toBe(0);
  publishExtensionEvent({ id: "notes.changed", projectId: "project" });
  expect(reads).toBe(1);
  dispose();
});

test("picker dependencies ignore rows in another project and include membership changes", () => {
  const ctx = createWorkbench();
  const service = createResourceLinksService(ctx as WorkbenchModuleContext, {
    type: "workspace",
    id: "a",
    projectId: "picker-project",
    extensionId: "pstdio",
  });
  let reads = 0;
  const dispose = service.subscribe(() => reads++);
  const writer = getWriter("sessions")!;
  try {
    writer.upsert({ id: "other-session", project_id: "other-project" });
    expect(reads).toBe(0);
    writer.upsert({ id: "other-session", project_id: "picker-project" });
    expect(reads).toBe(1);
    writer.remove("other-session");
    expect(reads).toBe(2);
  } finally {
    dispose();
    writer.remove("other-session");
  }
});

test("storage resets follow source, provider and resolved-target owners with a conservative legacy fallback", async () => {
  const ctx = createWorkbench();
  ctx.commandPaletteResources.registerProvider({
    id: "notes",
    extensionId: "notes",
    title: "Notes",
    query: async () => [],
  });
  const service = createResourceLinksService(ctx as WorkbenchModuleContext, {
    type: "workspace",
    id: "w",
    projectId: "project",
    extensionId: "pstdio",
  });
  let reads = 0;
  const stop = service.subscribe(() => reads++);
  try {
    publishExtensionEventReset({ projectId: "project", extensionId: "marmalade", recordIds: ["presentation"] });
    publishExtensionEventReset({ projectId: "other", extensionId: "notes" });
    expect(reads).toBe(0);
    publishExtensionEventReset({ projectId: "project", extensionId: "notes" });
    expect(reads).toBe(1);
    await service.resolve([{ type: "task", id: "one", projectId: "project", extensionId: "tasks" }]);
    publishExtensionEventReset({ projectId: "project", extensionId: "tasks" });
    expect(reads).toBe(2);
    publishExtensionEventReset({});
    expect(reads).toBe(3);
    ctx.commandPaletteResources.registerProvider({ id: "legacy", title: "Legacy", query: async () => [] });
    reads = 0;
    publishExtensionEventReset({ projectId: "project", extensionId: "marmalade" });
    expect(reads).toBe(1);
  } finally {
    stop();
    await ctx.dispose();
  }
});

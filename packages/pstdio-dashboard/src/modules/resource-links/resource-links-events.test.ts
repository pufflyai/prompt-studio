import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { publishExtensionEvent } from "@/shared/extensions/extension-webview-broadcast";
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

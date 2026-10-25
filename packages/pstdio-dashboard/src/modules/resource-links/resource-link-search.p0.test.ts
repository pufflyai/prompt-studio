import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { searchLinkResources } from "./resource-link-search";

test("finds a matching host resource beyond the first page", async () => {
  const ctx = createWorkbench();
  ctx.resources.registerProvider({
    id: "workspaces",
    kind: "workspace",
    list: () =>
      Array.from({ length: 40 }, (_, index) => ({
        resource: { type: "workspace", id: String(index), label: `WS-${index}` },
      })),
  });
  const items = await searchLinkResources(ctx as WorkbenchModuleContext, "project", "WS-39");
  expect(items.map((item) => item.resource.id)).toEqual(["39"]);
});

test("omits discovery results from unavailable owners and undeclared host kinds", async () => {
  const ctx = createWorkbench();
  ctx.commandPaletteResources.registerProvider({
    id: "notes",
    title: "Notes",
    query: async () => [
      {
        id: "disabled",
        label: "Disabled",
        resource: { type: "note", id: "one", extensionId: "disabled" },
        activate() {},
      },
      {
        id: "unknown",
        label: "Unknown",
        resource: { type: "unknown", id: "two", extensionId: "pstdio" },
        activate() {},
      },
    ],
  });
  expect(await searchLinkResources(ctx as WorkbenchModuleContext, "project", "")).toEqual([]);
});

import { describe, expect, test } from "bun:test";
import { normalizeExtensionSources } from "pstdio-extensions";
import { buildWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

describe("buildWorkbenchExtensionMetadata controls", () => {
  test("includes workbench controls renderer contributions", () => {
    const runtime = normalizeExtensionSources([
      {
        sourcePath: "/extension/extension.ts",
        sourceKind: "local_path",
        packagePath: "/extension",
        manifest: {
          id: "pstdio.planner",
          name: "planner",
          displayName: "Planner",
          version: "1.0.0",
          publisher: "pstdio",
          main: "./extension.ts",
          enginesPstdio: "^1.0.0",
        },
        definition: {
          controls: {
            ticketInspector: {
              title: "Ticket inspector",
              resourceKind: "ticket",
              queryCommand: "readTicketControls",
              updateValueCommand: "updateTicketControl",
              applyCommand: "applyTicketControls",
              resetCommand: "resetTicketControls",
              refreshEvents: [{ id: "ticket.updated" }],
              defaultValues: { priority: "medium" },
              emptyTitle: "No ticket selected",
              emptyDescription: "Open a ticket to inspect its controls.",
              layout: { area: "main-right", defaultPx: 320 },
            },
          },
        },
      },
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.controls).toEqual([
      {
        id: "planner.ticketInspector",
        extensionId: "pstdio.planner",
        title: "Ticket inspector",
        resourceKind: "ticket",
        queryCommandId: "planner.readTicketControls",
        updateValueCommandId: "planner.updateTicketControl",
        applyCommandId: "planner.applyTicketControls",
        resetCommandId: "planner.resetTicketControls",
        refreshEventIds: ["ticket.updated"],
        defaultValues: { priority: "medium" },
        emptyTitle: "No ticket selected",
        emptyDescription: "Open a ticket to inspect its controls.",
        layout: { area: "main-right", defaultPx: 320 },
      },
    ]);
  });
});

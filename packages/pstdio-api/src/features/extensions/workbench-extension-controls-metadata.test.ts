import { describe, expect, test } from "bun:test";
import { normalizeExtensionSources } from "pstdio-extensions";
import { createExtensionWebviewAccess } from "./extension-webview-access";
import {
  type BuildWorkbenchExtensionMetadataInput,
  buildWorkbenchExtensionMetadata as buildWorkbenchExtensionMetadataWithAccess,
} from "./workbench-extension-metadata";

const webviewUrlIssuer = createExtensionWebviewAccess({ signingKey: Buffer.from("test-webview-signing-key") });
const buildWorkbenchExtensionMetadata = (input: Omit<BuildWorkbenchExtensionMetadataInput, "webviewUrlIssuer">) =>
  buildWorkbenchExtensionMetadataWithAccess({ ...input, webviewUrlIssuer });

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
          controlsRenderers: {
            ticketInspector: {
              title: "Ticket inspector",
              query: async () => ({}),
              onValueChange: async () => undefined,
              onApply: async () => undefined,
              onReset: async () => undefined,
              refreshEvents: [{ id: "ticket.updated" }],
              defaultValues: { priority: "medium" },
              emptyTitle: "No ticket selected",
              emptyDescription: "Open a ticket to inspect its controls.",
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

    expect(metadata.controlsRenderers).toEqual([
      {
        id: "planner.ticketInspector",
        extensionId: "pstdio.planner",
        title: "Ticket inspector",
        queryHandlerId: "planner.ticketInspector.controls.query",
        valueChangeHandlerId: "planner.ticketInspector.controls.onValueChange",
        applyHandlerId: "planner.ticketInspector.controls.onApply",
        resetHandlerId: "planner.ticketInspector.controls.onReset",
        refreshEventIds: ["ticket.updated"],
        defaultValues: { priority: "medium" },
        emptyTitle: "No ticket selected",
        emptyDescription: "Open a ticket to inspect its controls.",
      },
    ]);
  });
});

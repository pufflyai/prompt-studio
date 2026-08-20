import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionContributions } from "./extension-contribution-registration";
import { metadata as baseMetadata } from "./module-test-fixtures";

// A resource kind has one owner: the extension that declared it. An extension that
// contributes a panel into someone else's slot must not claim that kind's presenter,
// or registering the owner fails and the owner loses every contribution it declared.
const sharedKindMetadata = {
  ...baseMetadata,
  extensions: [
    {
      id: "pstdio.insights",
      name: "insights",
      displayName: "Insights",
      sourcePath: "/extensions/insights/extension.ts",
    },
    { id: "pstdio.planner", name: "planner", displayName: "Planner", sourcePath: "/extensions/planner/extension.ts" },
  ],
  commands: [{ id: "planner.tickets.query", extensionId: "pstdio.planner", title: "Query tickets" }],
  kanbanRenderers: [
    {
      id: "planner.tickets",
      extensionId: "pstdio.planner",
      title: "Tickets",
      resourceKind: "planner.ticket",
      queryHandlerId: "planner.tickets.query",
    },
  ],
  modes: [
    {
      id: "planner.ticket-mode",
      extensionId: "pstdio.planner",
      modeId: "planner.ticket-mode",
      label: "Ticket",
      panelRegions: ["main", "side"],
      resources: {
        "planner.ticket": {
          slots: {
            primary: { region: "main", required: true },
            inspector: { region: "side" },
          },
        },
      },
    },
  ],
  resourceKinds: [
    {
      id: "planner.ticket",
      extensionId: "pstdio.planner",
      surface: "primary",
      slots: {
        primary: { cardinality: "one", external: false },
        inspector: { cardinality: "many", external: true },
      },
    },
  ],
  panels: [
    {
      id: "planner.tickets",
      extensionId: "pstdio.planner",
      supportedRegions: ["main"],
      title: "Tickets",
      renderer: { kind: "kanban", id: "planner.tickets" },
    },
    {
      id: "planner.editor",
      extensionId: "pstdio.planner",
      supportedRegions: ["main"],
      title: "Ticket",
      webview: {
        entry: { kind: "package-asset", path: "./editor.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/modules/planner.editor.js",
      },
    },
    {
      id: "insights.details",
      extensionId: "pstdio.insights",
      supportedRegions: ["side"],
      title: "Insights",
      webview: {
        entry: { kind: "package-asset", path: "./insights.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/modules/insights.details.js",
      },
    },
  ],
  resourcePanels: [
    {
      id: "planner.editor",
      extensionId: "pstdio.planner",
      resourceKind: "planner.ticket",
      panel: "planner.editor",
      slot: "primary",
    },
    {
      id: "insights.ticketDetails",
      extensionId: "pstdio.insights",
      resourceKind: "planner.ticket",
      panel: "insights.details",
      slot: "inspector",
    },
  ],
} satisfies DashboardExtensionMetadata;

describe("resource kind ownership", () => {
  test("registers both extensions when one contributes into the other's resource kind", () => {
    const workbench = createWorkbenchCore();
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const failures: unknown[] = [];
    const disposables = registerExtensionContributions({
      ctx: workbench,
      executeCommand: async () => ({ outcome: { ok: true, value: { rows: [] } } }) as never,
      metadata: sharedKindMetadata,
      onRegistrationError: (error) => failures.push(error),
      projectId: "project-1",
    });

    try {
      expect(failures).toEqual([]);
      // The owner keeps every contribution it declared, including its board panel.
      expect(workbench.layout.getPanel("planner.tickets")).toBeDefined();
      expect(workbench.renderers.getKanbanRenderer("planner.tickets")).toBeDefined();
    } finally {
      for (const disposable of disposables) disposable.dispose();
    }
  });
});

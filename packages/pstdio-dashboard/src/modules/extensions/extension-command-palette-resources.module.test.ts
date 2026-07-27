import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { flushMicrotasks, metadata, response } from "./module-test-fixtures";

describe("createExtensionsModule command palette resources", () => {
  test("registers extension command palette resource providers and maps query results", async () => {
    const queryCommandId = "pstdio-planner.query-ticket-resources";
    const loadMetadata = mock(async () => ({
      ...metadata,
      commandPaletteResources: [
        {
          id: "pstdio-planner.tickets",
          extensionId: "pstdio.pstdio-planner",
          title: "Tickets",
          resourceKind: "ticket",
          queryCommandId,
        },
      ],
    }));
    const executeCommand = mock(async (_projectId: string, commandId: string) => {
      if (commandId !== queryCommandId) return response;
      return {
        commandId,
        extensionId: "pstdio.pstdio-planner",
        outcome: {
          ok: true,
          status: "success",
          value: {
            items: [
              {
                id: "PS-1",
                label: "PS-1: Fix bug",
                target: { kind: "resource", resource: { type: "ticket", id: "PS-1", label: "PS-1: Fix bug" } },
              },
            ],
          },
        },
      } satisfies CommandExecuteResponse;
    });
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, executeCommand }));

    try {
      await flushMicrotasks();

      expect(workbench.commandPaletteResources.listProviders().map((provider) => provider.title)).toContain("Tickets");

      const groups = await workbench.commandPaletteResources.queryProviders({ query: "PS", limit: 10 });
      const tickets = groups.find((group) => group.providerId === "pstdio-planner.tickets");
      expect(tickets?.results.map((entry) => entry.label)).toEqual(["PS-1: Fix bug"]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});

import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionCommandPaletteResourceRecord } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionCommandPaletteResources } from "./command-palette-resource-contributions";

const record: WorkbenchExtensionCommandPaletteResourceRecord = {
  id: "lab.slides",
  extensionId: "pstdio.lab",
  title: "Slides",
  resourceKind: "lab.slide",
  queryCommandId: "lab.querySlides",
};

describe("registerWorkbenchExtensionCommandPaletteResources", () => {
  test("queries the provider command and maps items, executing the command target on activate", async () => {
    const workbench = createWorkbenchCore();
    const calls: Array<{ commandId: string; body: Record<string, unknown> }> = [];
    const executeCommand = (commandId: string, body: Record<string, unknown>) => {
      calls.push({ commandId, body });
      if (commandId === "lab.querySlides") {
        return {
          items: [
            {
              id: "intro",
              label: "Intro",
              description: "First slide",
              icon: "Presentation",
              target: { kind: "command", command: "lab.openSlide", params: { slideId: "intro" } },
            },
          ],
        };
      }
      return undefined;
    };

    registerWorkbenchExtensionCommandPaletteResources({ executeCommand, projectId: "p1", workbench }, [record]);

    expect(workbench.commandPaletteResources.listProviders().map((provider) => provider.title)).toEqual(["Slides"]);

    const results = await workbench.commandPaletteResources.queryProviders({ query: "in", limit: 10 });
    expect(results).toEqual([
      {
        providerId: "lab.slides",
        title: "Slides",
        results: [
          expect.objectContaining({
            id: "lab.slides:intro",
            label: "Intro",
            description: "First slide",
            icon: "Presentation",
            group: "Slides",
          }),
        ],
      },
    ]);

    const queryCall = calls.find((call) => call.commandId === "lab.querySlides");
    expect(queryCall?.body).toMatchObject({
      projectId: "p1",
      params: { providerId: "lab.slides", query: "in", limit: 10 },
    });

    await results[0]?.results[0]?.activate();
    const activateCall = calls.find((call) => call.commandId === "lab.openSlide");
    expect(activateCall?.body).toMatchObject({ params: { slideId: "intro" } });
  });

  test("opens resource targets by replacing the active resource tab", async () => {
    const workbench = createWorkbenchCore();
    const opens: Array<{ replaceActive?: boolean }> = [];
    const executeCommand = () => ({
      items: [
        {
          id: "PS-1",
          label: "PS-1",
          target: { kind: "resource", resource: { type: "ticket", id: "PS-1", label: "PS-1" } },
        },
      ],
    });

    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    workbench.resources.registerOpener({
      id: "ticket",
      canOpen: (resource) => resource.kind === "ticket",
      open: (_resource, input) => {
        opens.push(input);
      },
    });
    registerWorkbenchExtensionCommandPaletteResources({ executeCommand, projectId: "p1", workbench }, [record]);

    const results = await workbench.commandPaletteResources.queryProviders({ query: "PS-1", limit: 10 });
    await results[0]?.results[0]?.activate();

    expect(opens).toEqual([{ replaceActive: true }]);
  });
});

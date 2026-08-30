import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionCommandPaletteResourceRecord } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { FILE_SECTION_NAVIGATION_METADATA_KEY } from "../../core/registries/renderers/file-section-navigation";
import { registerWorkbenchExtensionCommandPaletteResources } from "./command-palette-resource-contributions";

const record: WorkbenchExtensionCommandPaletteResourceRecord = {
  id: "lab.slides",
  extensionId: "pstdio.lab",
  title: "Slides",
  resourceKind: "lab.slide",
  queryHandlerId: "lab.querySlides",
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
              target: {
                kind: "command",
                target: {
                  command: { kind: "command", id: "openSlide" },
                  params: { slideId: "intro" },
                },
              },
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
    const activateCall = calls.find((call) => call.commandId === "pstdio.lab.command.openSlide");
    expect(activateCall?.body).toMatchObject({ params: { slideId: "intro" } });
  });

  test("opens page targets with the resource argument and the section deep link", async () => {
    const workbench = createWorkbenchCore();
    const executeCommand = () => ({
      items: [
        {
          id: "PS-1",
          label: "PS-1",
          target: {
            kind: "page",
            page: { kind: "page", id: "tickets" },
            resource: { type: "ticket", id: "PS-1", label: "PS-1" },
            section: { anchors: [{ id: "acceptance-criteria", heading: "Acceptance Criteria" }] },
          },
        },
      ],
    });

    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    workbench.layout.registerPanel({
      id: "pstdio.lab.view.ticket",
      title: "Ticket",
      region: "main",
      rendererId: "test",
    });
    workbench.pages.registry.registerPage({
      id: "pstdio.lab.page.tickets",
      title: "Tickets",
      extensionId: "pstdio.lab",
      slots: [{ id: "ticket", region: "main", cardinality: "many" }],
      bindings: [{ kind: "ticket", panelId: "pstdio.lab.view.ticket", slot: "ticket" }],
    });
    registerWorkbenchExtensionCommandPaletteResources({ executeCommand, projectId: "p1", workbench }, [record]);

    const results = await workbench.commandPaletteResources.queryProviders({ query: "PS", limit: 10 });
    await results[0]?.results[0]?.activate();

    const instances = workbench.layout.listPanelInstances("main");
    expect(instances).toContainEqual(
      expect.objectContaining({
        panelId: "pstdio.lab.view.ticket",
        resource: expect.objectContaining({
          id: "PS-1",
          metadata: {
            [FILE_SECTION_NAVIGATION_METADATA_KEY]: {
              treeId: "lab.slides",
              targetNodeId: "PS-1",
              anchors: [{ id: "acceptance-criteria", heading: "Acceptance Criteria" }],
            },
          },
        }),
      }),
    );
  });

  test("opens compound targets only after every item validates", async () => {
    const workbench = createWorkbenchCore();
    const opened: string[] = [];
    const executeCommand = () => ({
      items: [
        {
          id: "compound",
          label: "Compound",
          target: {
            kind: "compound",
            targets: [
              { kind: "page", page: { kind: "page", id: "tickets" } },
              { kind: "page", page: { kind: "page", id: "missing" } },
            ],
          },
        },
      ],
    });

    workbench.layout.registerPanel({
      id: "pstdio.lab.view.ticket",
      title: "Ticket",
      region: "main",
      rendererId: "test",
    });
    workbench.pages.registry.registerPage({
      id: "pstdio.lab.page.tickets",
      title: "Tickets",
      extensionId: "pstdio.lab",
      slots: [{ id: "board", region: "main", panelId: "pstdio.lab.view.ticket", closable: false }],
    });
    workbench.pages.onDidChangeLocation((location) => opened.push(location.pageId));
    registerWorkbenchExtensionCommandPaletteResources({ executeCommand, projectId: "p1", workbench }, [record]);

    const results = await workbench.commandPaletteResources.queryProviders({ query: "compound", limit: 10 });
    await expect(results[0]?.results[0]?.activate()).rejects.toThrow(
      "Cannot open navigation page target: pstdio.lab.page.missing",
    );

    expect(opened).toEqual([]);
  });
});

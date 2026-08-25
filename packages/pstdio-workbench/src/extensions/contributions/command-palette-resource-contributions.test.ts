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

  test("opens resource targets with the requested placement strategy", async () => {
    const workbench = createWorkbenchCore();
    const opens: Array<{ input: { replaceActive?: boolean }; metadata?: Record<string, unknown> }> = [];
    const executeCommand = () => ({
      items: [
        {
          id: "PS-1",
          label: "PS-1",
          target: {
            kind: "resource",
            resource: { type: "ticket", id: "PS-1", label: "PS-1" },
            input: { strategy: "persistent" },
            section: { anchors: [{ id: "acceptance-criteria", heading: "Acceptance Criteria" }] },
          },
        },
        {
          id: "PS-2",
          label: "PS-2",
          target: {
            kind: "compound",
            targets: [
              {
                kind: "resource",
                resource: { type: "ticket", id: "PS-2", label: "PS-2" },
                section: { anchors: [{ id: "notes", heading: "Notes" }] },
              },
            ],
          },
        },
      ],
    });

    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    workbench.layout.registerPanel({
      id: "ticket",
      title: "Ticket",
      region: "main",
      rendererId: "test",
    });
    workbench.resources.registerPresenter({
      id: "ticket",
      canOpen: (resource) => resource.kind === "ticket",
      open: (resource, input) => {
        opens.push({ input, metadata: resource.metadata });
        return workbench.layout.openPanel("ticket");
      },
    });
    registerWorkbenchExtensionCommandPaletteResources({ executeCommand, projectId: "p1", workbench }, [record]);

    const results = await workbench.commandPaletteResources.queryProviders({ query: "PS", limit: 10 });
    await results[0]?.results[0]?.activate();
    await results[0]?.results[1]?.activate();

    expect(opens).toEqual([
      {
        input: {},
        metadata: {
          [FILE_SECTION_NAVIGATION_METADATA_KEY]: {
            treeId: "lab.slides",
            targetNodeId: "PS-1",
            anchors: [{ id: "acceptance-criteria", heading: "Acceptance Criteria" }],
          },
        },
      },
      {
        input: {},
        metadata: {
          [FILE_SECTION_NAVIGATION_METADATA_KEY]: {
            treeId: "lab.slides",
            targetNodeId: "PS-2",
            anchors: [{ id: "notes", heading: "Notes" }],
          },
        },
      },
    ]);
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
              { kind: "view", viewId: "ticket" },
              { kind: "view", viewId: "missing" },
            ],
          },
        },
      ],
    });

    workbench.layout.registerPanel({
      id: "ticket",
      title: "Ticket",
      region: "main",
      rendererId: "test",
    });
    workbench.views.registerView({ id: "ticket", panelId: "ticket", title: "Ticket" });
    workbench.views.onDidOpenView(({ viewId }) => opened.push(viewId));
    registerWorkbenchExtensionCommandPaletteResources({ executeCommand, projectId: "p1", workbench }, [record]);

    const results = await workbench.commandPaletteResources.queryProviders({ query: "compound", limit: 10 });
    await expect(results[0]?.results[0]?.activate()).rejects.toThrow("Cannot open navigation view target: missing");

    expect(opened).toEqual([]);
  });
});

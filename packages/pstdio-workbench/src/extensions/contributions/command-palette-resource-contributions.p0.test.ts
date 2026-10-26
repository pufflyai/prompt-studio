import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionCommandPaletteResourceRecord } from "@pstdio/sdk/api";
import { createWorkbench } from "../../core";
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
    const workbench = createWorkbench();
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
});

test("keeps canonical resource identity from owner navigation results", async () => {
  const workbench = createWorkbench();
  registerWorkbenchExtensionCommandPaletteResources(
    {
      projectId: "p1",
      workbench,
      executeCommand: () => ({
        items: [
          {
            id: "intro",
            label: "Intro",
            target: {
              kind: "page",
              page: { kind: "page", id: "slides" },
              resource: { type: "slide", id: "intro" },
            },
          },
        ],
      }),
    },
    [record],
  );
  const groups = await workbench.commandPaletteResources.queryProviders({ query: "", limit: 10 });
  expect(groups[0]?.results[0]?.resource).toEqual({
    type: "slide",
    id: "intro",
    projectId: "p1",
    extensionId: "pstdio.lab",
  });
});

test("passes search cancellation to the owner command", async () => {
  const workbench = createWorkbench();
  const signal = new AbortController().signal;
  let received: AbortSignal | undefined;
  registerWorkbenchExtensionCommandPaletteResources(
    {
      projectId: "p1",
      workbench,
      executeCommand: (_id, _body, requestSignal) => {
        received = requestSignal;
        return { items: [] };
      },
    },
    [record],
  );
  await workbench.commandPaletteResources.queryProviders({ query: "", limit: 25, signal });
  expect(received).toBe(signal);
});

import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionControlsRendererRecord, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionControlsRenderers } from "./controls-renderer-contributions";

type ControlsViewRecord = WorkbenchExtensionMetadata["panels"][number];

describe("registerWorkbenchExtensionControlsRenderers", () => {
  test("registers and opens controls-backed panels in declaration order", () => {
    const workbench = createWorkbenchCore();
    const record = {
      id: "inspector",
      extensionId: "acme.image-tools",
      title: "Inspector",
      queryHandlerId: "image-tools.controls.query",
    } satisfies WorkbenchExtensionControlsRendererRecord;
    const panels = [
      {
        id: "inspector-a",
        extensionId: "acme.image-tools",
        title: "A",
        supportedRegions: ["main"],
        renderer: { kind: "controls", id: "inspector" },
      },
      {
        id: "inspector-b",
        extensionId: "acme.image-tools",
        title: "B",
        supportedRegions: ["main"],
        renderer: { kind: "controls", id: "inspector" },
      },
      {
        id: "inspector-c",
        extensionId: "acme.image-tools",
        title: "C",
        supportedRegions: ["main"],
        renderer: { kind: "controls", id: "inspector" },
      },
    ] satisfies ControlsViewRecord[];

    registerWorkbenchExtensionControlsRenderers(
      { projectId: "project-1", workbench, executeCommand: async () => ({}) },
      [record],
      panels,
    );

    expect(workbench.layout.listPanels().map((panel) => panel.id)).toEqual([
      "inspector-a",
      "inspector-b",
      "inspector-c",
    ]);

    workbench.layout.openPanel("inspector-a", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("inspector-b", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("inspector-c", { strategy: { kind: "persistent" } });

    expect(workbench.layout.listPanelInstances("main").map((panel) => panel.panelId)).toEqual([
      "inspector-a",
      "inspector-b",
      "inspector-c",
    ]);
  });

  test("wires query/update/reset commands and registers a widget for the controls panel", async () => {
    const workbench = createWorkbenchCore();
    const executed: string[] = [];
    const record = {
      id: "inspector",
      extensionId: "acme.image-tools",
      title: "Inspector",
      queryHandlerId: "image-tools.controls.query",
      valueChangeHandlerId: "image-tools.controls.onValueChange",
      resetHandlerId: "image-tools.controls.onReset",
    } satisfies WorkbenchExtensionControlsRendererRecord;

    const panel = {
      id: "inspector-panel",
      extensionId: "acme.image-tools",
      title: "Inspector",
      supportedRegions: ["main"],
      renderer: { kind: "controls", id: "inspector" },
    } satisfies ControlsViewRecord;

    registerWorkbenchExtensionControlsRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (commandId) => {
          executed.push(commandId);
          if (commandId === "image-tools.controls.query") {
            return { params: [{ id: "a", name: "A", type: "number", defaultValue: 1 }] };
          }
          return undefined;
        },
      },
      [record],
      [panel],
      undefined,
      [
        {
          id: "acme.image-tools.inspector",
          extensionId: "acme.image-tools",
          resourceKind: "image",
          panel: "inspector-panel",
          slot: "inspector",
        },
      ],
    );

    const renderer = workbench.renderers.getControlsRenderer("inspector");
    expect(renderer).toBeDefined();

    // The panel widget falls back to its first supported region; the resource
    // kinds it serves come from its resource-panel edges.
    expect(workbench.layout.getPanel("inspector-panel")).toMatchObject({
      region: "main",
      rendererId: "inspector",
      resourceKinds: ["image"],
    });

    const result = await renderer?.executeQuery();
    expect(result?.params).toHaveLength(1);

    await renderer?.updateValue?.({ controlId: "a", value: 5, values: { a: 5 } });
    await renderer?.reset?.({});

    expect(executed).toEqual([
      "image-tools.controls.query",
      "image-tools.controls.onValueChange",
      "image-tools.controls.onReset",
    ]);
  });

  test("leaves the renderer read-only when no update/apply/reset commands are provided", () => {
    const workbench = createWorkbenchCore();
    const record = {
      id: "readonly",
      extensionId: "acme.image-tools",
      title: "Read only",
      queryHandlerId: "image-tools.controls.query",
    } satisfies WorkbenchExtensionControlsRendererRecord;

    registerWorkbenchExtensionControlsRenderers(
      { projectId: "project-1", workbench, executeCommand: async () => ({}) },
      [record],
      [],
    );

    const renderer = workbench.renderers.getControlsRenderer("readonly");
    expect(renderer?.updateValue).toBeUndefined();
    expect(renderer?.apply).toBeUndefined();
    expect(renderer?.reset).toBeUndefined();
  });
});

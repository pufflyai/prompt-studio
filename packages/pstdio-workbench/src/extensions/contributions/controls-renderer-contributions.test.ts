import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionControlsRendererRecord, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionControlsRenderers } from "./controls-renderer-contributions";

type ControlsViewRecord = WorkbenchExtensionMetadata["panels"][number];

describe("registerWorkbenchExtensionControlsRenderers", () => {
  test("honors panel placement when registering and opening controls-backed panels", () => {
    const workbench = createWorkbenchCore();
    const record = {
      id: "inspector",
      extensionId: "acme.image-tools",
      title: "Inspector",
      queryCommandId: "image-tools.load",
    } satisfies WorkbenchExtensionControlsRendererRecord;
    const panels = [
      {
        id: "inspector-last",
        extensionId: "acme.image-tools",
        title: "Last",
        closable: false,
        region: "main",
        placement: "last",
        controlsRendererId: "inspector",
      },
      {
        id: "inspector-default",
        extensionId: "acme.image-tools",
        title: "Default",
        closable: false,
        region: "main",
        controlsRendererId: "inspector",
      },
      {
        id: "inspector-first",
        extensionId: "acme.image-tools",
        title: "First",
        closable: false,
        region: "main",
        placement: "first",
        controlsRendererId: "inspector",
      },
    ] satisfies ControlsViewRecord[];

    registerWorkbenchExtensionControlsRenderers(
      { projectId: "project-1", workbench, executeCommand: async () => ({}) },
      [record],
      panels,
    );

    expect(workbench.layout.listPanels().map((panel) => panel.id)).toEqual([
      "inspector-first",
      "inspector-default",
      "inspector-last",
    ]);

    workbench.layout.openPanel("inspector-last", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("inspector-default", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("inspector-first", { strategy: { kind: "persistent" } });

    expect(workbench.layout.listPanelInstances("main").map((panel) => panel.panelId)).toEqual([
      "inspector-first",
      "inspector-default",
      "inspector-last",
    ]);
  });

  test("wires query/update/reset commands and registers a widget for the controls panel", async () => {
    const workbench = createWorkbenchCore();
    const executed: string[] = [];
    const record = {
      id: "inspector",
      extensionId: "acme.image-tools",
      title: "Inspector",
      queryCommandId: "image-tools.load",
      updateValueCommandId: "image-tools.update",
      resetCommandId: "image-tools.reset",
    } satisfies WorkbenchExtensionControlsRendererRecord;

    const panel = {
      id: "inspector-panel",
      extensionId: "acme.image-tools",
      title: "Inspector",
      closable: false,
      resourceKind: "image",
      region: "main",
      controlsRendererId: "inspector",
    } satisfies ControlsViewRecord;

    registerWorkbenchExtensionControlsRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (commandId) => {
          executed.push(commandId);
          if (commandId === "image-tools.load") {
            return { params: [{ id: "a", name: "A", type: "number", defaultValue: 1 }] };
          }
          return undefined;
        },
      },
      [record],
      [panel],
    );

    const renderer = workbench.renderers.getControlsRenderer("inspector");
    expect(renderer).toBeDefined();

    // The Panel places the renderer in its declared region.
    expect(workbench.layout.getPanel("inspector-panel")).toMatchObject({
      region: "main",
      rendererId: "inspector",
      resourceKinds: ["image"],
    });

    const result = await renderer?.executeQuery();
    expect(result?.params).toHaveLength(1);

    await renderer?.updateValue?.({ controlId: "a", value: 5, values: { a: 5 } });
    await renderer?.reset?.({});

    expect(executed).toEqual(["image-tools.load", "image-tools.update", "image-tools.reset"]);
  });

  test("leaves the renderer read-only when no update/apply/reset commands are provided", () => {
    const workbench = createWorkbenchCore();
    const record = {
      id: "readonly",
      extensionId: "acme.image-tools",
      title: "Read only",
      queryCommandId: "image-tools.load",
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

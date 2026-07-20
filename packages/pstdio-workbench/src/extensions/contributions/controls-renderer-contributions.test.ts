import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionControlsRendererRecord, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionControlsRenderers } from "./controls-renderer-contributions";

type ControlsViewRecord = WorkbenchExtensionMetadata["views"][number];

describe("registerWorkbenchExtensionControlsRenderers", () => {
  test("wires query/update/reset commands and registers a widget for the controls view", async () => {
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

    const view = {
      id: "inspector-panel",
      extensionId: "acme.image-tools",
      slotId: "inspector-panel",
      title: "Inspector",
      resourceKind: "image",
      surface: "panel",
      target: "workbench.main.right",
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
      [view],
    );

    const renderer = workbench.renderers.getControlsRenderer("inspector");
    expect(renderer).toBeDefined();

    // The view places the renderer into a right-panel widget keyed by the view id.
    expect(workbench.layout.getWidget("inspector-panel")).toMatchObject({
      region: "main-right-menu",
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

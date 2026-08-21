import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { panelResourceKinds } from "./panel-contributions";

type PanelRecord = WorkbenchExtensionMetadata["panels"][number];
type ResourcePanels = WorkbenchExtensionMetadata["resourcePanels"];

describe("panelResourceKinds", () => {
  test("keeps an unscoped panel visible outside its resource placements", () => {
    const panel = {
      id: "lab.artifacts",
      extensionId: "pstdio.lab",
      title: "Artifacts",
      show: [{ region: "main" }, { for: "blend-project", region: "side" }],
      renderer: { kind: "dataTable", id: "lab.artifacts" },
    } satisfies PanelRecord;
    const resourcePanels = [
      {
        id: "lab.ticket-insights",
        extensionId: "pstdio.lab",
        resourceKind: "ticket",
        panel: panel.id,
        slot: "inspector",
      },
    ] satisfies ResourcePanels;

    expect(panelResourceKinds(panel, resourcePanels)).toBeUndefined();
  });

  test("restricts a panel when every placement is resource-scoped", () => {
    const panel = {
      id: "planner.editor",
      extensionId: "pstdio.planner",
      title: "Editor",
      show: { for: "ticket", region: "main" },
      renderer: { kind: "file", id: "planner.ticket" },
    } satisfies PanelRecord;

    expect(panelResourceKinds(panel, [])).toEqual(["ticket"]);
  });
});

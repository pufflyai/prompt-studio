import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { WorkbenchSidePanelRegionPortal } from "./workbench-side-panel-layout";

const workbench = createWorkbenchCore();

const renderSidePanelPortal = (mounted: boolean) => {
  return WorkbenchSidePanelRegionPortal({
    workbench,
    hasSidePanel: true,
    mounted,
    sidePanelHost: { nodeType: 1 } as HTMLDivElement,
  } as Parameters<typeof WorkbenchSidePanelRegionPortal>[0] & { mounted: boolean });
};

describe("WorkbenchSidePanelRegionPortal", () => {
  test("keeps the Side Panel mounted while its host waits for the next visible slot", () => {
    const portal = renderSidePanelPortal(true);

    expect(portal).not.toBeNull();
  });

  test("unmounts the Side Panel when it is no longer mounted", () => {
    const portal = renderSidePanelPortal(false);

    expect(portal).toBeNull();
  });
});

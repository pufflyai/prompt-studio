import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { WorkbenchSessionRegionPortal } from "./workbench-session-layout";

const workbench = createWorkbenchCore();

const renderFloatingSessionPortal = (mounted: boolean) => {
  return WorkbenchSessionRegionPortal({
    workbench,
    hasSidePanel: true,
    mounted,
    sessionHost: { nodeType: 1 } as HTMLDivElement,
  } as Parameters<typeof WorkbenchSessionRegionPortal>[0] & { mounted: boolean });
};

describe("WorkbenchSessionRegionPortal", () => {
  test("keeps the session mounted while the host is waiting for the next visible slot", () => {
    const portal = renderFloatingSessionPortal(true);

    expect(portal).not.toBeNull();
  });

  test("unmounts the session when the panel is not mounted", () => {
    const portal = renderFloatingSessionPortal(false);

    expect(portal).toBeNull();
  });
});

import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { WorkbenchFloatingSessionPortal } from "./workbench-session-layout";

const workbench = createWorkbenchCore();

const renderFloatingSessionPortal = (mounted: boolean) => {
  return WorkbenchFloatingSessionPortal({
    workbench,
    hasFloatingPanel: true,
    mounted,
    sessionHost: { nodeType: 1 } as HTMLDivElement,
  } as Parameters<typeof WorkbenchFloatingSessionPortal>[0] & { mounted: boolean });
};

describe("WorkbenchFloatingSessionPortal", () => {
  test("keeps the session mounted while the host is waiting for the next visible slot", () => {
    const portal = renderFloatingSessionPortal(true);

    expect(portal).not.toBeNull();
  });

  test("unmounts the session when the panel is not mounted", () => {
    const portal = renderFloatingSessionPortal(false);

    expect(portal).toBeNull();
  });
});

import { resourceKey } from "@pstdio/sdk/extensions";
import type { CreateLayoutModelInput } from "../../registries/layout/layout-model-types";
import type { WorkbenchCore } from "../../workbench-core-types";

/** Structural mode reconciliation uses restoreLayout; direct edits use these guards. */
export const layoutPanelGuards = (
  resolve: () => WorkbenchCore,
): Pick<CreateLayoutModelInput, "validateRegionChange" | "validateWidgetOpen"> => ({
  validateRegionChange(region, action) {
    const core = resolve();
    if (!core || core.modes.isTransitioning()) return;
    const policy = core.shell.getPanelPolicy(region);
    if (!policy.provided) throw new Error(`Panel is not provided: ${region}`);
    const allowed = { open: policy.canOpen, close: policy.canClose, resize: policy.resizable }[action];
    if (!allowed) throw new Error(`Panel cannot ${action}: ${region}`);
  },
  validateWidgetOpen(region, existing, target) {
    const core = resolve();
    if (!core || core.modes.isTransitioning() || !["main", "secondary", "side"].includes(region)) return;
    const policy = core.shell.getPanelPolicy(region);
    if (!policy.provided) throw new Error(`Panel is not provided: ${region}`);
    const receivesTab =
      !existing || (target.resource && resourceKey(existing.resource) !== resourceKey(target.resource));
    if (receivesTab && !policy.acceptsTabs) throw new Error(`Panel cannot accept tabs: ${region}`);
    if (!policy.open && !policy.canOpen) throw new Error(`Panel cannot open: ${region}`);
  },
});

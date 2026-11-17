import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout } from "@pstdio/workbench";

const isLegacyTerminal = (widget: WorkbenchLayout["regions"]["secondary"]["widgets"][number]) =>
  widget.viewId === "workbench.terminal" &&
  widget.placementIdentity?.kind === "shell" &&
  widget.placementIdentity.placementId === "workbench.terminal" &&
  widget.resource?.type === "terminal" &&
  widget.resource.extensionId === "pstdio";

/** Rebind saved tabs, never process handles; the installed view opens a fresh PTY. */
export const migrateLegacyTerminalLayout = (layout: WorkbenchLayout) => {
  if (!Object.values(layout.regions).some((region) => region.widgets.some(isLegacyTerminal))) return layout;
  const next = structuredClone(layout);
  for (const region of Object.values(next.regions)) {
    for (const widget of region.widgets) {
      if (!isLegacyTerminal(widget) || !widget.resource) continue;
      widget.resource = { ...widget.resource, extensionId: "pstdio.pstdio-terminal" };
      widget.resourceKey = resourceKey(widget.resource);
      widget.viewId = "pstdio.pstdio-terminal.view.terminal";
      widget.ownerId = "pstdio.pstdio-terminal";
      widget.source = "extension";
      widget.placementIdentity = {
        kind: "mode",
        modeId: "project",
        placementId: "pstdio.pstdio-terminal.placement.terminal",
        instanceKey: widget.resourceKey,
      };
    }
  }
  return next;
};

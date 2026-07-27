import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

type ExtensionViewRecord = DashboardExtensionMetadata["views"][number];

export interface ResourceEditorGroup {
  kind: string;
  primary: ExtensionViewRecord;
  companions: ExtensionViewRecord[];
}

const explicitMainTarget = (target: ExtensionViewRecord["target"]) => target === "workbench.main";

// Older/default primary editors may omit target, while mode-owned companions can
// also omit it because their placement comes from mode layout. Prefer explicit
// main editors before falling back to the legacy no-target default.
const defaultMainTarget = (target: ExtensionViewRecord["target"]) => !target;

// Groups editor + companion side-panel views by resource kind. The primary editor
// docks in `main`; companion views (e.g. a properties panel targeting main-right)
// open alongside it bound to the same resource. Modal views are excluded — they
// create rows via the kanban-renderer flow, not as resource openers.
export const groupResourceEditorViews = (views: ExtensionViewRecord[]): ResourceEditorGroup[] => {
  const byKind = new Map<string, ExtensionViewRecord[]>();

  for (const view of views) {
    if (!view.resourceKind || view.role === "modal") continue;
    const group = byKind.get(view.resourceKind) ?? [];
    group.push(view);
    byKind.set(view.resourceKind, group);
  }

  return [...byKind]
    .map(([kind, kindViews]) => {
      const locations = kindViews.filter((view) => view.role === "location");
      const primary =
        locations.find((view) => explicitMainTarget(view.target)) ??
        locations.find((view) => defaultMainTarget(view.target));
      return primary
        ? {
            kind,
            primary,
            companions: kindViews.filter((view) => view.role === "sub-panel" || view.role === "panel-menu"),
          }
        : undefined;
    })
    .filter((group): group is ResourceEditorGroup => Boolean(group));
};

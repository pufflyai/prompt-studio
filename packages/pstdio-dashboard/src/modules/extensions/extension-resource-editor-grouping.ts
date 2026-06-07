import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

type ExtensionViewRecord = DashboardExtensionMetadata["views"][number];

export interface ResourceEditorGroup {
  kind: string;
  primary: ExtensionViewRecord;
  companions: ExtensionViewRecord[];
}

// An undefined or explicit "workbench.main" target docks in the main area, which
// is where the primary editor for a resource lives.
const isMainTarget = (target: ExtensionViewRecord["target"]) => !target || target === "workbench.main";

// Groups editor + companion side-panel views by resource kind. The primary editor
// docks in `main`; companion views (e.g. a properties panel targeting main-right)
// open alongside it bound to the same resource. Modal views are excluded — they
// create rows via the data-renderer flow, not as resource openers.
export const groupResourceEditorViews = (views: ExtensionViewRecord[]): ResourceEditorGroup[] => {
  const byKind = new Map<string, ExtensionViewRecord[]>();

  for (const view of views) {
    if (!view.resourceKind || view.surface === "modal") continue;
    const group = byKind.get(view.resourceKind) ?? [];
    group.push(view);
    byKind.set(view.resourceKind, group);
  }

  return [...byKind].map(([kind, kindViews]) => {
    const primary = kindViews.find((view) => isMainTarget(view.target)) ?? kindViews[0];
    return { kind, primary, companions: kindViews.filter((view) => view !== primary) };
  });
};

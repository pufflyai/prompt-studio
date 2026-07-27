import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

type ExtensionPanelRecord = DashboardExtensionMetadata["panels"][number];

export interface ResourceEditorGroup {
  kind: string;
  primary: ExtensionPanelRecord;
  companions: ExtensionPanelRecord[];
}

// Groups editor + companion side-panel views by resource kind. The primary editor
// docks in `main`; companion views (e.g. a properties panel targeting main-right)
// open alongside it bound to the same resource. Modal views are excluded — they
// create rows via the kanban-renderer flow, not as resource presenters.
export const groupResourceEditorViews = (panels: ExtensionPanelRecord[]): ResourceEditorGroup[] => {
  const byKind = new Map<string, ExtensionPanelRecord[]>();

  for (const panel of panels) {
    if (!panel.resourceKind || panel.region === "overlay") continue;
    const group = byKind.get(panel.resourceKind) ?? [];
    group.push(panel);
    byKind.set(panel.resourceKind, group);
  }

  return [...byKind]
    .map(([kind, kindViews]) => {
      const primary = kindViews.find((panel) => panel.region === "main");
      return primary
        ? {
            kind,
            primary,
            companions: kindViews.filter((panel) => panel !== primary),
          }
        : undefined;
    })
    .filter((group): group is ResourceEditorGroup => Boolean(group));
};

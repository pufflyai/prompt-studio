import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

type ExtensionViewRecord = DashboardExtensionMetadata["views"][number];
type ExtensionControlsRecord = NonNullable<DashboardExtensionMetadata["controls"]>[number];

export interface ResourceEditorGroup {
  kind: string;
  primary: ExtensionViewRecord;
  companions: ExtensionViewRecord[];
}

// A control renderer bound to a resource kind opens as a side-panel companion of that
// kind's editor, mirroring a companion view. Its widget id is the renderer id and its
// area/title come straight from the contribution (no per-mode overrides).
export interface ResourceControlsCompanion {
  widgetId: string;
  resourceKind: string;
  extensionId: string;
  record: ExtensionControlsRecord;
}

export const groupResourceControlsCompanions = (controls: ExtensionControlsRecord[]) => {
  const byKind = new Map<string, ResourceControlsCompanion[]>();

  for (const record of controls) {
    if (!record.resourceKind) continue;
    const companions = byKind.get(record.resourceKind) ?? [];
    companions.push({
      widgetId: record.id,
      resourceKind: record.resourceKind,
      extensionId: record.extensionId,
      record,
    });
    byKind.set(record.resourceKind, companions);
  }

  return byKind;
};

const explicitMainTarget = (target: ExtensionViewRecord["target"]) => target === "workbench.main";

// Older/default primary editors may omit target, while mode-owned companions can
// also omit it because their placement comes from mode layout. Prefer explicit
// main editors before falling back to the legacy no-target default.
const defaultMainTarget = (target: ExtensionViewRecord["target"]) => !target;

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
    const primary =
      kindViews.find((view) => explicitMainTarget(view.target)) ??
      kindViews.find((view) => defaultMainTarget(view.target)) ??
      kindViews[0];
    return { kind, primary, companions: kindViews.filter((view) => view !== primary) };
  });
};

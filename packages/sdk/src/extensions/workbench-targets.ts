export const workbenchMenuTargets = [
  "workbench.nav.actions",
  "workbench.nav.overflow",
  "workbench.commandPalette",
] as const;

export const workbenchTreeTargets = [
  "workbench.left.tree",
  "workbench.main.left.tree",
  "workbench.main.right.tree",
] as const;

export const workbenchViewTargets = [
  "workbench.main",
  "workbench.main.left",
  "workbench.main.right",
  "workbench.secondary",
] as const;

export const workbenchSettingsTargets = ["workbench.settings"] as const;

export const workbenchSettingsScopes = ["project", "global"] as const;

export const workbenchModeLayoutTargets = [
  "workbench.left",
  "workbench.main.left",
  "workbench.main",
  "workbench.main.right",
  "workbench.secondary",
] as const;

export type WorkbenchMenuTarget = (typeof workbenchMenuTargets)[number];
export type WorkbenchTreeTarget = (typeof workbenchTreeTargets)[number];
export type WorkbenchViewTarget = (typeof workbenchViewTargets)[number];
export type WorkbenchSettingsTarget = (typeof workbenchSettingsTargets)[number];
export type WorkbenchSettingsScope = (typeof workbenchSettingsScopes)[number];
export type WorkbenchModeLayoutTarget = (typeof workbenchModeLayoutTargets)[number];
export type WorkbenchLayoutTarget = WorkbenchModeLayoutTarget;

export type WorkbenchAttachmentTarget =
  | WorkbenchMenuTarget
  | WorkbenchTreeTarget
  | WorkbenchViewTarget
  | WorkbenchSettingsTarget;

export type WorkbenchContributionKind = "menu" | "treeItem" | "view" | "settings";

export type WorkbenchTargetGranularity = "surface" | "area" | "areaTree";

export interface WorkbenchTargetDefinition {
  id: WorkbenchAttachmentTarget;
  allowedKinds: readonly WorkbenchContributionKind[];
  granularity: WorkbenchTargetGranularity;
  rationale: string;
}

export const workbenchTargets = [
  {
    id: "workbench.nav.actions",
    allowedKinds: ["menu"],
    granularity: "surface",
    rationale: "Primary command surface in the host-owned nav (top) workbench chrome.",
  },
  {
    id: "workbench.nav.overflow",
    allowedKinds: ["menu"],
    granularity: "surface",
    rationale: "Secondary command surface in the host-owned nav (top) workbench chrome.",
  },
  {
    id: "workbench.commandPalette",
    allowedKinds: ["menu"],
    granularity: "surface",
    rationale: "Global command discovery surface owned by the workbench.",
  },
  {
    id: "workbench.left.tree",
    allowedKinds: ["treeItem"],
    granularity: "areaTree",
    rationale: "Tree entries for the active tree renderer mounted in the left area.",
  },
  {
    id: "workbench.main.left.tree",
    allowedKinds: ["treeItem"],
    granularity: "areaTree",
    rationale: "Tree entries for the active tree renderer mounted in the main-left area.",
  },
  {
    id: "workbench.main.right.tree",
    allowedKinds: ["treeItem"],
    granularity: "areaTree",
    rationale: "Tree entries for the active tree renderer mounted in the main-right area.",
  },
  {
    id: "workbench.main",
    allowedKinds: ["view"],
    granularity: "area",
    rationale: "Direct extension view placement in the main area.",
  },
  {
    id: "workbench.main.left",
    allowedKinds: ["view"],
    granularity: "area",
    rationale: "Direct extension view placement in the main-left area.",
  },
  {
    id: "workbench.main.right",
    allowedKinds: ["view"],
    granularity: "area",
    rationale: "Direct extension view placement in the main-right area.",
  },
  {
    id: "workbench.secondary",
    allowedKinds: ["view"],
    granularity: "area",
    rationale: "Direct extension view placement in the secondary area.",
  },
  {
    id: "workbench.settings",
    allowedKinds: ["settings"],
    granularity: "surface",
    rationale: "Settings panel placement in host-owned settings navigation.",
  },
] as const satisfies readonly WorkbenchTargetDefinition[];

export const getWorkbenchTargetDefinition = (id: string) => workbenchTargets.find((target) => target.id === id);

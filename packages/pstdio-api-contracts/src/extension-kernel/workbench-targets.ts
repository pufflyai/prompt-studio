export const workbenchMenuTargets = ["workbench.nav.actions", "workbench.nav.overflow"] as const;

export const workbenchTreeTargets = [
  "workbench.left.tree",
  "workbench.main.left.tree",
  "workbench.main.right.tree",
] as const;

export const workbenchRegions = [
  "nav",
  "activity",
  "sidenav-header",
  "sidenav",
  "main-header",
  "main",
  "secondary-header",
  "secondary",
  "side-header",
  "side",
  "status",
  "overlay",
] as const;

export const workbenchViewTargets = [
  "workbench.main",
  "workbench.main.left",
  "workbench.main.right",
  "workbench.secondary",
] as const;

export const workbenchSettingsTargets = ["workbench.settings"] as const;

export const workbenchSettingsScopes = ["project", "global"] as const;

export const workbenchModePanels = ["main", "secondary", "side"] as const;

export const workbenchModeLayoutTargets = [
  "workbench.left",
  "workbench.main.left",
  "workbench.main",
  "workbench.main.right",
  "workbench.secondary",
] as const;

export type WorkbenchMenuTarget = (typeof workbenchMenuTargets)[number];
export type WorkbenchTreeTarget = (typeof workbenchTreeTargets)[number];
export type WorkbenchRegion = (typeof workbenchRegions)[number];
export type WorkbenchViewTarget = (typeof workbenchViewTargets)[number];
export type WorkbenchSettingsTarget = (typeof workbenchSettingsTargets)[number];
export type WorkbenchSettingsScope = (typeof workbenchSettingsScopes)[number];
export type WorkbenchModePanel = (typeof workbenchModePanels)[number];
export type WorkbenchModeLayoutTarget = (typeof workbenchModeLayoutTargets)[number];
export type WorkbenchLayoutTarget = WorkbenchModeLayoutTarget;

const workbenchModeLayoutTargetPanels = {
  "workbench.left": undefined,
  "workbench.main.left": "main",
  "workbench.main": "main",
  "workbench.main.right": "main",
  "workbench.secondary": "secondary",
} as const satisfies Record<WorkbenchModeLayoutTarget, WorkbenchModePanel | undefined>;

export const getWorkbenchModeLayoutTargetPanel = (target: WorkbenchModeLayoutTarget) =>
  workbenchModeLayoutTargetPanels[target];

export const normalizeWorkbenchModePanels = (input: unknown) => {
  const panels = Array.isArray(input)
    ? input.filter((panel): panel is WorkbenchModePanel => (workbenchModePanels as readonly unknown[]).includes(panel))
    : [...workbenchModePanels];
  const invalid =
    input !== undefined &&
    (!Array.isArray(input) || panels.length !== input.length || new Set(panels).size !== panels.length);

  return { panels, invalid };
};

export type WorkbenchAttachmentTarget =
  | WorkbenchMenuTarget
  | WorkbenchTreeTarget
  | WorkbenchViewTarget
  | WorkbenchSettingsTarget;

export type WorkbenchContributionKind = "menu" | "treeItem" | "panel" | "settings";

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
    id: "workbench.settings",
    allowedKinds: ["settings"],
    granularity: "surface",
    rationale: "Settings panel placement in host-owned settings navigation.",
  },
] as const satisfies readonly WorkbenchTargetDefinition[];

export const getWorkbenchTargetDefinition = (id: string) => workbenchTargets.find((target) => target.id === id);

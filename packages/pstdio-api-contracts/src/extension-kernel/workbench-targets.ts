export const workbenchMenuTargets = ["workbench.nav.actions", "workbench.nav.overflow"] as const;

export const workbenchTreeTargets = [
  "workbench.left.tree",
  "workbench.main.left.tree",
  "workbench.main.right.tree",
] as const;

export const workbenchRegions = [
  "nav",
  "activity",
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

export type WorkbenchAttachmentTarget =
  | WorkbenchMenuTarget
  | WorkbenchTreeTarget
  | WorkbenchViewTarget
  | WorkbenchSettingsTarget;

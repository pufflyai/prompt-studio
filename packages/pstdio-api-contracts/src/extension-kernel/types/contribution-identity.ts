export type ContributionKind =
  | "activity-item"
  | "artifact-mount"
  | "command"
  | "command-palette-resource"
  | "file-icon-theme"
  | "harness"
  | "hook"
  | "keybinding"
  | "middleware"
  | "mode"
  | "navigation-item"
  | "placement"
  | "resource-hierarchy-provider"
  | "resource-kind"
  | "resource-view"
  | "schedule"
  | "settings-panel"
  | "settings-section"
  | "skill"
  | "status"
  | "status-bar-item"
  | "template"
  | "template-type"
  | "theme"
  | "view"
  | "view-menu"
  | "workspace-type";

export interface ContributionRef<Kind extends ContributionKind> {
  readonly extensionId?: string;
  readonly kind: Kind;
  readonly id: string;
}

export interface ContributionDefinition<Kind extends ContributionKind> {
  readonly id: string;
  readonly ref: ContributionRef<Kind>;
}

export type ContributionInput<Kind extends ContributionKind> = Omit<ContributionDefinition<Kind>, "ref">;

export type ModeRef = ContributionRef<"mode">;
export type NavigationSlotRef = ContributionRef<"navigation-item">;
export type PlacementRef = ContributionRef<"placement">;
export type ResourceKindRef = ContributionRef<"resource-kind">;
export interface ResourceSlotRef {
  readonly resourceKind: ResourceKindRef;
  readonly id: string;
}
export type ResourceViewRef = ContributionRef<"resource-view">;
export type SettingsSectionRef = ContributionRef<"settings-section">;
export interface SettingsSlotRef {
  readonly id: string;
}
export interface StatusBarSlotRef {
  readonly id: string;
}
export type StatusRef = ContributionRef<"status">;
export type ViewRef = ContributionRef<"view">;

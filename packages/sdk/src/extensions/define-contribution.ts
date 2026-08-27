import type {
  ActivityItemContribution,
  ArtifactMountContribution,
  CommandPaletteResourceContribution,
  ContributionDefinition,
  ContributionKind,
  ExtensionConnectionContribution,
  FileIconThemeContribution,
  HarnessProvider,
  KeybindingContribution,
  ModeContribution,
  NavigationItemContribution,
  PlacementContribution,
  ResourceHierarchyProvider,
  ResourceKindDefinition,
  ResourceKindRef,
  ResourceSlotRef,
  ResourceViewContribution,
  ScheduleContribution,
  SettingsPanelContribution,
  SettingsSectionContribution,
  SkillContribution,
  StatusBarItemContribution,
  StatusContribution,
  TemplateContribution,
  TemplateTypeContribution,
  ThemeContribution,
  ViewContribution,
  ViewMenuContribution,
  WorkspaceTypeProvider,
} from "pstdio-api-contracts/extension-kernel";
import { defineSlot } from "pstdio-api-contracts/extension-kernel";

const defineContribution =
  <Kind extends ContributionKind>(_kind: Kind) =>
  <Definition extends { id: string }>(definition: Definition) => ({
    ...definition,
    ref: { kind: _kind, id: definition.id },
  });

export const defineView = defineContribution("view") as <Definition extends Omit<ViewContribution, "ref">>(
  definition: Definition,
) => Definition & ContributionDefinition<"view">;

export const defineViewMenu = defineContribution("view-menu") as <Definition extends Omit<ViewMenuContribution, "ref">>(
  definition: Definition,
) => Definition & ContributionDefinition<"view-menu">;

export const definePlacement = defineContribution("placement") as <
  Definition extends Omit<PlacementContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"placement">;

export const defineResourceKind = defineContribution("resource-kind") as <
  Definition extends Omit<ResourceKindDefinition, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"resource-kind">;

export const resourceSlotRef = (resourceKind: ResourceKindRef, id: string): ResourceSlotRef => ({
  resourceKind,
  id,
});

export const resourceMenuSlotRef = (resourceKind: ResourceKindRef, id: string) =>
  defineSlot(`${resourceKind.id}.${id}`, { kind: "menu" });

export const defineResourceView = defineContribution("resource-view") as <
  Definition extends Omit<ResourceViewContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"resource-view">;

export const defineNavigationItem = defineContribution("navigation-item") as <
  Definition extends Omit<NavigationItemContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"navigation-item">;

export const defineMode = defineContribution("mode") as <Definition extends Omit<ModeContribution, "ref">>(
  definition: Definition,
) => Definition & ContributionDefinition<"mode">;

export const defineStatusBarItem = defineContribution("status-bar-item") as <
  Definition extends Omit<StatusBarItemContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"status-bar-item">;

export const defineStatuses = defineContribution("status") as <Definition extends Omit<StatusContribution, "ref">>(
  definition: Definition,
) => Definition & ContributionDefinition<"status">;

export const defineSettingsPanel = defineContribution("settings-panel") as <
  Definition extends Omit<SettingsPanelContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"settings-panel">;

export const defineActivityItem = defineContribution("activity-item") as <
  Definition extends Omit<ActivityItemContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"activity-item">;

export const defineSettingsSection = defineContribution("settings-section") as <
  Definition extends Omit<SettingsSectionContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"settings-section">;

export const defineCommandPaletteResource = defineContribution("command-palette-resource") as <
  Definition extends Omit<CommandPaletteResourceContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"command-palette-resource">;

export const defineKeybinding = defineContribution("keybinding") as <
  Definition extends Omit<KeybindingContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"keybinding">;

export const defineSchedule = defineContribution("schedule") as <Definition extends Omit<ScheduleContribution, "ref">>(
  definition: Definition,
) => Definition & ContributionDefinition<"schedule">;

export const defineArtifactMount = defineContribution("artifact-mount") as <
  Definition extends Omit<ArtifactMountContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"artifact-mount">;

export const defineTemplateType = defineContribution("template-type") as <
  Definition extends Omit<TemplateTypeContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"template-type">;

export const defineTemplate = defineContribution("template") as <Definition extends Omit<TemplateContribution, "ref">>(
  definition: Definition,
) => Definition & ContributionDefinition<"template">;

export const defineSkill = defineContribution("skill") as <Definition extends Omit<SkillContribution, "ref">>(
  definition: Definition,
) => Definition & ContributionDefinition<"skill">;

export const defineTheme = defineContribution("theme") as <Definition extends Omit<ThemeContribution, "ref">>(
  definition: Definition,
) => Definition & ContributionDefinition<"theme">;

export const defineFileIconTheme = defineContribution("file-icon-theme") as <
  Definition extends Omit<FileIconThemeContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"file-icon-theme">;

export const defineWorkspaceType = defineContribution("workspace-type") as <
  Definition extends Omit<WorkspaceTypeProvider, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"workspace-type">;

export const defineHarness = defineContribution("harness") as <Definition extends Omit<HarnessProvider, "ref">>(
  definition: Definition,
) => Definition & ContributionDefinition<"harness">;

export const defineConnection = defineContribution("connection") as <
  Definition extends Omit<ExtensionConnectionContribution, "ref">,
>(
  definition: Definition,
) => Definition & ContributionDefinition<"connection">;

export const defineResourceHierarchyProvider = (definition: Omit<ResourceHierarchyProvider, "ref">) => ({
  ...definition,
  ref: { kind: "resource-hierarchy-provider" as const, id: definition.id },
});

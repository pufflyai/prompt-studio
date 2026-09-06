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
  NavigationTreeContribution,
  PageContribution,
  PageRef,
  PageSlot,
  PageSlotBinding,
  PageSlotRef,
  PlacementContribution,
  ResourceHierarchyProvider,
  ResourceKindDefinition,
  ResourceKindRef,
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

type NoExtraFields<Definition, Contract> = Definition & Record<Exclude<keyof Definition, keyof Contract>, never>;

type ViewDefinition = Omit<ViewContribution, "ref">;

export const defineView = defineContribution("view") as <const Definition extends ViewDefinition>(
  definition: NoExtraFields<Definition, ViewDefinition>,
) => Definition & ContributionDefinition<"view">;

type ViewMenuDefinition = Omit<ViewMenuContribution, "ref">;
export const defineViewMenu = defineContribution("view-menu") as <const Definition extends ViewMenuDefinition>(
  definition: NoExtraFields<Definition, ViewMenuDefinition>,
) => Definition & ContributionDefinition<"view-menu">;

type PlacementDefinition = Omit<PlacementContribution, "ref">;
export const definePlacement = defineContribution("placement") as <const Definition extends PlacementDefinition>(
  definition: NoExtraFields<Definition, PlacementDefinition>,
) => Definition & ContributionDefinition<"placement">;

type ResourceKindDefinitionInput = Omit<ResourceKindDefinition, "ref">;
export const defineResourceKind = defineContribution("resource-kind") as <
  const Definition extends ResourceKindDefinitionInput,
>(
  definition: NoExtraFields<Definition, ResourceKindDefinitionInput>,
) => Definition & ContributionDefinition<"resource-kind">;

export const resourceMenuSlotRef = (resourceKind: ResourceKindRef, id: string) =>
  defineSlot(`${resourceKind.id}.${id}`, { kind: "menu" });

type NavigationItemDefinition = Omit<NavigationItemContribution, "ref">;
export const defineNavigationItem = defineContribution("navigation-item") as <
  const Definition extends NavigationItemDefinition,
>(
  definition: NoExtraFields<Definition, NavigationItemDefinition>,
) => Definition & ContributionDefinition<"navigation-item">;

type NavigationTreeDefinition = Omit<NavigationTreeContribution, "ref">;
export const defineNavigationTree = defineContribution("navigation-tree") as <
  const Definition extends NavigationTreeDefinition,
>(
  definition: NoExtraFields<Definition, NavigationTreeDefinition>,
) => Definition & ContributionDefinition<"navigation-tree">;

type ModeDefinition = Omit<ModeContribution, "ref">;
export const defineMode = defineContribution("mode") as <const Definition extends ModeDefinition>(
  definition: NoExtraFields<Definition, ModeDefinition>,
) => Definition & ContributionDefinition<"mode">;

type AuxiliarySlotIds<Slots extends readonly PageSlot[]> = Extract<Slots[number], { role: "auxiliary" }>["id"];

type PagePanelRefs<Slots extends readonly PageSlot[]> = {
  readonly [Id in AuxiliarySlotIds<Slots>]: PageSlotRef;
};

type PageDefinition = Omit<PageContribution, "ref" | "panels">;
type RequiredPageParent<Definition extends PageDefinition> =
  Extract<Definition["slots"][number], { role: "primary"; binding: PageSlotBinding }> extends never
    ? unknown
    : { readonly parent: PageRef };

export const definePage = <const Definition extends PageDefinition>(
  definition: NoExtraFields<Definition, PageDefinition> & RequiredPageParent<Definition>,
): Definition & ContributionDefinition<"page"> & { readonly panels: PagePanelRefs<Definition["slots"]> } => {
  const ref = { kind: "page" as const, id: definition.id };
  const panels = Object.fromEntries(
    definition.slots
      .filter((slot) => slot.role === "auxiliary")
      .map((slot) => [slot.id, { kind: "page-slot" as const, page: ref, id: slot.id }]),
  ) as PagePanelRefs<Definition["slots"]>;
  return { ...definition, ref, panels };
};

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

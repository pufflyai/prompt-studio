import type {
  ActivityItemContribution,
  CommandPaletteResourceContribution,
  ExtensionSettingProperty,
  FileIconThemeContribution,
  KeybindingContribution,
  Localizable,
  ModeContribution,
  NavigationItemContribution,
  NavigationTarget,
  NavigationTreeContribution,
  PageContribution,
  PageSlot,
  PlacementContribution,
  RendererEventReference,
  ResourceHierarchyProvider,
  ResourceKindDefinition,
  SettingsPanelContribution,
  SettingsSectionContribution,
  SkillContribution,
  StatusBarItemContribution,
  StatusContribution,
  TemplateContribution,
  TemplateTypeContribution,
  ThemeContribution,
  ThemeMode,
  ViewContribution,
  ViewMenuContribution,
  WhenExpression,
} from "@pstdio/sdk/extensions";

export type ThemePreferenceTokens = Record<string, string>;

export interface RuntimeThemePreference {
  id: string;
  mode: ThemeMode;
  tokens: ThemePreferenceTokens;
}

export interface RuntimeMonacoTheme {
  base: "vs" | "vs-dark";
  inherit: true;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

export interface RuntimeViewRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: ViewContribution;
}

export interface RuntimeViewMenuRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: ViewMenuContribution;
}

export interface RuntimePlacementTab {
  queryHandlerId: string;
  refreshEvents?: readonly RendererEventReference[];
}

export type RuntimePlacementContribution = Omit<PlacementContribution, "tab"> & {
  tab?: RuntimePlacementTab;
};

export interface RuntimePlacementRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: RuntimePlacementContribution;
}

export interface RuntimeNavigationItemRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: NavigationItemContribution;
}

export interface RuntimeNavigationTreeRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: NavigationTreeContribution;
}

export interface RuntimePageRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: Omit<PageContribution, "slots"> & {
    slots: RuntimePageSlot[];
  };
}

// Omit must distribute over the PageSlot union so each variant keeps its own fields.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type RuntimePageSlot = DistributiveOmit<PageSlot, "tab"> & {
  tab?: RuntimePlacementTab;
};

export interface RuntimeStatusBarItemRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: StatusBarItemContribution;
}

export interface RuntimeStatusRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: StatusContribution;
}

export interface RuntimeResourceKindRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: Omit<ResourceKindDefinition, "menuSlots"> & {
    menuSlots: Record<
      string,
      {
        placement: "header-primary" | "header-overflow" | "context-menu";
        label?: Localizable<string>;
        external: boolean;
        order?: number;
      }
    >;
  };
}

export interface RuntimeResourceHierarchyProviderRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  resourceKindId: string;
  provider: ResourceHierarchyProvider;
}

export interface RuntimeActivityItemRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: ActivityItemContribution;
}

export interface RuntimeModeRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: ModeContribution;
}

export interface RuntimeSettingsPanelRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: SettingsPanelContribution;
}

export interface RuntimeSettingsSectionRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: SettingsSectionContribution;
}

export interface RuntimeCommandPaletteResourceRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: CommandPaletteResourceContribution;
}

export interface ParsedKeybindingChord {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  modifiers: string[];
}

export interface RuntimeKeybindingRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  /** The contribution's action with contribution refs resolved to absolute ids. */
  action: NavigationTarget;
  contribution: KeybindingContribution;
  /** Platform-independent canonical chord produced by TanStack hotkey normalization. */
  canonicalChord: string;
  parsed: ParsedKeybindingChord;
  when?: WhenExpression;
}

export interface RuntimeExtensionSettingRecord {
  id: string;
  key: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: ExtensionSettingProperty;
}

export interface RuntimeTemplateTypeRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: TemplateTypeContribution;
}

export interface RuntimeTemplateRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: TemplateContribution;
}

export interface RuntimeSkillRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: SkillContribution;
}

export interface RuntimeThemeRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  title: Localizable<string>;
  description?: Localizable<string>;
  format: ThemeContribution["format"];
  mode: ThemeMode;
  source: ThemeContribution["source"];
  preference: RuntimeThemePreference;
  monacoTheme: RuntimeMonacoTheme;
}

export interface RuntimeFileIconThemeFont {
  fontFamily: string;
  src: { url: string; format?: string }[];
  weight?: string;
  style?: string;
}

export interface RuntimeFileIconThemeRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  title: Localizable<string>;
  description?: Localizable<string>;
  format: FileIconThemeContribution["format"];
  source: FileIconThemeContribution["source"];
  definitions: Record<string, unknown>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  defaults: { file?: string; folder?: string };
  fonts: RuntimeFileIconThemeFont[];
}

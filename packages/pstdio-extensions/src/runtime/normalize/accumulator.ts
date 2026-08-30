import type { CommandRef, EventRef } from "@pstdio/sdk/extensions";
import type {
  ExtensionDiagnostic,
  ExtensionRuntime,
  RuntimeArtifactMount,
  RuntimeCliContribution,
  RuntimeCommandPaletteResourceRecord,
  RuntimeCommandRecord,
  RuntimeFileIconThemeRecord,
  RuntimeKeybindingRecord,
  RuntimePrivateHandlerRecord,
  RuntimeStatusRecord,
  RuntimeThemeRecord,
  RuntimeTranslationRecord,
  RuntimeViewRecord,
} from "../../types/runtime";

export type Accumulator = ExtensionRuntime;

export type RegistryIndex = {
  commandIds: Map<string, RuntimeCommandRecord>;
  privateHandlerIds: Map<string, RuntimePrivateHandlerRecord>;
  cliKeys: Map<string, RuntimeCliContribution>;
  mountKeys: Map<string, RuntimeArtifactMount>;
  commandPaletteResourceIds: Map<string, RuntimeCommandPaletteResourceRecord>;
  themeIds: Map<string, RuntimeThemeRecord>;
  fileIconThemeIds: Map<string, RuntimeFileIconThemeRecord>;
  translationIds: Map<string, RuntimeTranslationRecord>;
  keybindingDedupe: Map<string, RuntimeKeybindingRecord>;
  viewIds: Map<string, RuntimeViewRecord>;
  statusIds: Map<string, RuntimeStatusRecord>;
};

export const createAccumulator = (initialDiagnostics: ExtensionDiagnostic[]): Accumulator => ({
  extensions: [],
  commands: [],
  connections: [],
  privateHandlers: [],
  middlewares: [],
  hooks: [],
  cli: [],
  schedules: [],
  artifactMounts: [],
  modes: [],
  views: [],
  viewMenus: [],
  placements: [],
  navigationItems: [],
  pages: [],
  statusBarItems: [],
  statuses: [],
  resourceKinds: [],
  resourceViews: [],
  resourceHierarchyProviders: [],
  activityItems: [],
  settingsSections: [],
  settingsPanels: [],
  commandPaletteResources: [],
  keybindings: [],
  settings: [],
  templateTypes: [],
  templates: [],
  skills: [],
  themes: [],
  fileIconThemes: [],
  translations: [],
  harnesses: [],
  workspaceTypes: [],
  diagnostics: [...initialDiagnostics],
});

export const createRegistryIndex = (): RegistryIndex => ({
  commandIds: new Map(),
  privateHandlerIds: new Map(),
  cliKeys: new Map(),
  mountKeys: new Map(),
  commandPaletteResourceIds: new Map(),
  themeIds: new Map(),
  fileIconThemeIds: new Map(),
  translationIds: new Map(),
  keybindingDedupe: new Map(),
  viewIds: new Map(),
  statusIds: new Map(),
});

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const refId = (ref: CommandRef | EventRef | string | undefined): string | null => {
  if (typeof ref === "string" && ref.length > 0) return ref;
  if (isRecord(ref) && typeof ref.id === "string" && ref.id.length > 0) return ref.id;
  return null;
};

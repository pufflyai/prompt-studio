import type { CommandRef, EventRef } from "@pstdio/sdk/extensions";
import type {
  ExtensionDiagnostic,
  ExtensionRuntime,
  RuntimeArtifactMount,
  RuntimeCliContribution,
  RuntimeCommandPaletteResourceRecord,
  RuntimeCommandRecord,
  RuntimeDataRendererRecord,
  RuntimeFileIconThemeRecord,
  RuntimeKeybindingRecord,
  RuntimeThemeRecord,
  RuntimeTranslationRecord,
  RuntimeTreeRendererRecord,
} from "../../types/runtime";

export type Accumulator = ExtensionRuntime;

export type RegistryIndex = {
  commandIds: Map<string, RuntimeCommandRecord>;
  cliKeys: Map<string, RuntimeCliContribution>;
  mountKeys: Map<string, RuntimeArtifactMount>;
  dataRendererIds: Map<string, RuntimeDataRendererRecord>;
  commandPaletteResourceIds: Map<string, RuntimeCommandPaletteResourceRecord>;
  treeRendererIds: Map<string, RuntimeTreeRendererRecord>;
  themeIds: Map<string, RuntimeThemeRecord>;
  fileIconThemeIds: Map<string, RuntimeFileIconThemeRecord>;
  translationIds: Map<string, RuntimeTranslationRecord>;
  keybindingDedupe: Map<string, RuntimeKeybindingRecord>;
};

export const createAccumulator = (initialDiagnostics: ExtensionDiagnostic[]): Accumulator => ({
  extensions: [],
  commands: [],
  middlewares: [],
  hooks: [],
  cli: [],
  schedules: [],
  artifactMounts: [],
  modes: [],
  views: [],
  routes: [],
  navigation: [],
  treeItems: [],
  settingsPanels: [],
  dataRenderers: [],
  commandPaletteResources: [],
  treeRenderers: [],
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
  cliKeys: new Map(),
  mountKeys: new Map(),
  dataRendererIds: new Map(),
  commandPaletteResourceIds: new Map(),
  treeRendererIds: new Map(),
  themeIds: new Map(),
  fileIconThemeIds: new Map(),
  translationIds: new Map(),
  keybindingDedupe: new Map(),
});

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const refId = (ref: CommandRef | EventRef | string | undefined): string | null => {
  if (typeof ref === "string" && ref.length > 0) return ref;
  if (isRecord(ref) && typeof ref.id === "string" && ref.id.length > 0) return ref.id;
  return null;
};

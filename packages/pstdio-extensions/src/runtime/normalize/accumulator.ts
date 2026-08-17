import type { CommandRef, EventRef } from "@pstdio/sdk/extensions";
import type {
  ExtensionDiagnostic,
  ExtensionRuntime,
  RuntimeArtifactMount,
  RuntimeCliContribution,
  RuntimeCommandPaletteResourceRecord,
  RuntimeCommandRecord,
  RuntimeControlsRendererRecord,
  RuntimeDataTableRendererRecord,
  RuntimeFileIconThemeRecord,
  RuntimeFileRendererRecord,
  RuntimeKanbanRendererRecord,
  RuntimeKeybindingRecord,
  RuntimePrivateHandlerRecord,
  RuntimeThemeRecord,
  RuntimeTranslationRecord,
  RuntimeTreeRendererRecord,
} from "../../types/runtime";

export type Accumulator = ExtensionRuntime;

export type RegistryIndex = {
  commandIds: Map<string, RuntimeCommandRecord>;
  privateHandlerIds: Map<string, RuntimePrivateHandlerRecord>;
  cliKeys: Map<string, RuntimeCliContribution>;
  mountKeys: Map<string, RuntimeArtifactMount>;
  kanbanRendererIds: Map<string, RuntimeKanbanRendererRecord>;
  dataTableRendererIds: Map<string, RuntimeDataTableRendererRecord>;
  commandPaletteResourceIds: Map<string, RuntimeCommandPaletteResourceRecord>;
  treeRendererIds: Map<string, RuntimeTreeRendererRecord>;
  fileRendererIds: Map<string, RuntimeFileRendererRecord>;
  controlsRendererIds: Map<string, RuntimeControlsRendererRecord>;
  themeIds: Map<string, RuntimeThemeRecord>;
  fileIconThemeIds: Map<string, RuntimeFileIconThemeRecord>;
  translationIds: Map<string, RuntimeTranslationRecord>;
  keybindingDedupe: Map<string, RuntimeKeybindingRecord>;
};

export const createAccumulator = (initialDiagnostics: ExtensionDiagnostic[]): Accumulator => ({
  extensions: [],
  commands: [],
  privateHandlers: [],
  middlewares: [],
  hooks: [],
  cli: [],
  schedules: [],
  artifactMounts: [],
  modes: [],
  panels: [],
  routes: [],
  treeItems: [],
  activityItems: [],
  settingsSections: [],
  settingsPanels: [],
  kanbanRenderers: [],
  dataTableRenderers: [],
  commandPaletteResources: [],
  treeRenderers: [],
  fileRenderers: [],
  controlsRenderers: [],
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
  kanbanRendererIds: new Map(),
  dataTableRendererIds: new Map(),
  commandPaletteResourceIds: new Map(),
  treeRendererIds: new Map(),
  fileRendererIds: new Map(),
  controlsRendererIds: new Map(),
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

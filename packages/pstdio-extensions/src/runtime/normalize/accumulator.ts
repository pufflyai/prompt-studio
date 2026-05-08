import type { CommandRef, EventRef } from "@pstdio/sdk/extensions";
import type {
  ExtensionDiagnostic,
  ExtensionRuntime,
  RuntimeArtifactMount,
  RuntimeCliContribution,
  RuntimeCommandRecord,
  RuntimeFileIconThemeRecord,
  RuntimeThemeRecord,
} from "../../types/runtime";

export type Accumulator = ExtensionRuntime;

export type RegistryIndex = {
  commandIds: Map<string, RuntimeCommandRecord>;
  cliKeys: Map<string, RuntimeCliContribution>;
  mountKeys: Map<string, RuntimeArtifactMount>;
  themeIds: Map<string, RuntimeThemeRecord>;
  fileIconThemeIds: Map<string, RuntimeFileIconThemeRecord>;
};

export const createAccumulator = (initialDiagnostics: ExtensionDiagnostic[]): Accumulator => ({
  extensions: [],
  commands: [],
  middlewares: [],
  hooks: [],
  cli: [],
  schedules: [],
  artifactMounts: [],
  views: [],
  routes: [],
  navigation: [],
  settingsPanels: [],
  templateTypes: [],
  templates: [],
  skills: [],
  themes: [],
  fileIconThemes: [],
  harnesses: [],
  workspaceTypes: [],
  diagnostics: [...initialDiagnostics],
});

export const createRegistryIndex = (): RegistryIndex => ({
  commandIds: new Map(),
  cliKeys: new Map(),
  mountKeys: new Map(),
  themeIds: new Map(),
  fileIconThemeIds: new Map(),
});

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const refId = (ref: CommandRef | EventRef | string | undefined): string | null => {
  if (typeof ref === "string" && ref.length > 0) return ref;
  if (isRecord(ref) && typeof ref.id === "string" && ref.id.length > 0) return ref.id;
  return null;
};

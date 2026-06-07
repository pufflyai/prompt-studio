import type {
  CommandExecuteRequest,
  CommandExecuteResponse,
  LocalizableString,
  WorkbenchExtensionMetadata,
} from "@pstdio/sdk/api";
import type { ResourceBrowseEntry } from "pstdio-workbench/core";

export type ExtensionBenchTemplateTypeContribution = {
  id: string;
  extensionId: string;
  label: LocalizableString;
  description?: LocalizableString;
};

export type ExtensionBenchTemplateContribution = {
  id: string;
  extensionId: string;
  title: LocalizableString;
  description?: LocalizableString;
  type: string;
  sourcePath: string;
};

export type ExtensionBenchSkillContribution = {
  id: string;
  extensionId: string;
  title: LocalizableString;
  description?: LocalizableString;
  sourcePath: string;
};

export type ExtensionBenchThemeContribution = {
  id: string;
  extensionId: string;
  title: LocalizableString;
  description?: LocalizableString;
  format: "vscode-color-theme";
  mode: "light" | "dark";
  tokens: Record<string, string>;
  monacoTheme: {
    base: "vs" | "vs-dark";
    inherit: true;
    rules: Record<string, unknown>[];
    colors: Record<string, string>;
  };
  sourcePath: string;
};

export type ExtensionBenchFileIconThemeContribution = {
  id: string;
  extensionId: string;
  title: LocalizableString;
  description?: LocalizableString;
  format: "vscode-file-icon-theme";
  sourcePath: string;
};

export type ExtensionBenchContributionInventory = {
  templateTypes: ExtensionBenchTemplateTypeContribution[];
  templates: ExtensionBenchTemplateContribution[];
  skills: ExtensionBenchSkillContribution[];
  themes: ExtensionBenchThemeContribution[];
  fileIconThemes: ExtensionBenchFileIconThemeContribution[];
};

export type ExtensionBenchResourceEntry = ResourceBrowseEntry;

export type ExtensionBenchSummary = {
  commands: number;
  diagnostics: number;
  extensions: number;
  keybindings: number;
  skills: number;
  templateTypes: number;
  templates: number;
  treeRenderers: number;
  views: number;
};

export type ExtensionBenchLoadResponse = {
  benchId: string;
  inventory: ExtensionBenchContributionInventory;
  metadata: WorkbenchExtensionMetadata;
  projectId: string;
  resources: ExtensionBenchResourceEntry[];
  sourcePath: string;
  summary: ExtensionBenchSummary;
};

export type ExtensionBenchCommandRequest = {
  benchId: string;
  commandId: string;
  request: CommandExecuteRequest;
};

export type ExtensionBenchCommandResponse = CommandExecuteResponse;

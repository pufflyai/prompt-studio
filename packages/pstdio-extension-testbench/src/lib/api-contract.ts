import type {
  CommandExecuteRequest,
  CommandExecuteResponse,
  LocalizableString,
  WorkbenchExtensionMetadata,
} from "@pstdio/sdk/api";

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

export type ExtensionBenchContributionInventory = {
  templateTypes: ExtensionBenchTemplateTypeContribution[];
  templates: ExtensionBenchTemplateContribution[];
  skills: ExtensionBenchSkillContribution[];
};

export type ExtensionBenchSummary = {
  commands: number;
  diagnostics: number;
  extensions: number;
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
  sourcePath: string;
  summary: ExtensionBenchSummary;
};

export type ExtensionBenchCommandRequest = {
  benchId: string;
  commandId: string;
  request: CommandExecuteRequest;
};

export type ExtensionBenchCommandResponse = CommandExecuteResponse;

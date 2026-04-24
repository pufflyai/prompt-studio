import type {
  ArtifactMountDefinition,
  CliContribution,
  CommandDefinition,
  ExtensionDefinition,
  ExtensionSourceKind,
  HarnessProviderDefinition,
  PackageAssetDescriptor,
  ParamSchema,
  TemplateTypeDefinition,
} from "./types";

export type NormalizedExtension = {
  id: string;
  displayName: string;
  version?: string;
  sourcePath: string;
  sourceKind: ExtensionSourceKind;
  definition: ExtensionDefinition;
};

export type RuntimeCliContribution = Omit<CliContribution, "examples"> & {
  path: string;
  pathSegments: string[];
  examples: string[];
  commandId: string;
  extensionId: string;
};

export type RuntimeCommandRecord = Omit<CommandDefinition, "cli" | "menus" | "params"> & {
  id: string;
  key: string;
  extensionId: string;
  params?: ParamSchema;
  menus: NonNullable<CommandDefinition["menus"]>;
  cli?: RuntimeCliContribution;
  sourcePath: string;
};

export type RuntimeArtifactMount = ArtifactMountDefinition & {
  id: string;
  key: string;
  extensionId: string;
  path: string;
  sourcePath: string;
};

export type RuntimeTemplateType = TemplateTypeDefinition & {
  id: string;
  key: string;
  extensionId: string;
};

export type RuntimeTemplate = {
  id: string;
  key: string;
  extensionId: string;
  title: string;
  type: string;
  source: PackageAssetDescriptor;
  description?: string;
  readOnly: true;
};

export type RuntimeSkill = {
  id: string;
  key: string;
  extensionId: string;
  title: string;
  source: PackageAssetDescriptor;
  description?: string;
  readOnly: true;
};

export type RuntimeHarnessProvider = HarnessProviderDefinition & {
  id: string;
  key: string;
  extensionId: string;
};

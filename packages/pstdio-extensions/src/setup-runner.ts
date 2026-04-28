import type { ExtensionCommandsApi, ExtensionFilesApi, ExtensionReposApi } from "@pstdio/sdk/extensions";
import type { DbClient } from "pstdio-db";
import { loadExtensionRuntime } from "./runtime";
import { createExtensionStorageContext } from "./storage-context";

type RunExtensionInitialSetupInput = {
  db: DbClient;
  eventBus?: {
    emit(table: string, op: "set" | "delete", data: unknown): void;
  };
  projectId: string;
  projectRoot?: string;
  includeLocal?: boolean;
};

const unsupportedFiles = {
  readText: async () => {
    throw new Error("Extension setup file access requires a file adapter.");
  },
  writeText: async () => {
    throw new Error("Extension setup file access requires a file adapter.");
  },
} satisfies ExtensionFilesApi;

const unsupportedRepos = {
  list: async () => [],
  getDefault: async () => {
    throw new Error("Extension setup repository access requires a repo adapter.");
  },
  resolvePath: async () => {
    throw new Error("Extension setup repository access requires a repo adapter.");
  },
} satisfies ExtensionReposApi;

const unsupportedCommands = {
  run: async () => {
    throw new Error("Extension setup command execution is not available during initial setup.");
  },
} satisfies ExtensionCommandsApi;

export const runExtensionInitialSetup = async (input: RunExtensionInitialSetupInput) => {
  const runtime = await loadExtensionRuntime({
    projectRoot: input.projectRoot ?? "",
    includeLocal: input.includeLocal ?? false,
  });

  for (const extension of runtime.extensions) {
    if (!extension.definition.initialSetup) continue;

    await extension.definition.initialSetup({
      projectId: input.projectId,
      storage: createExtensionStorageContext({
        db: input.db,
        projectId: input.projectId,
        extensionId: extension.id,
        eventBus: input.eventBus,
      }),
      files: unsupportedFiles,
      repos: unsupportedRepos,
      commands: unsupportedCommands,
    });
  }
};

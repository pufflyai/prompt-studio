import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionSetupContext, RuntimeHarnessProvider } from "@pstdio/sdk/extensions";
import type { createExtensionInstancesDBService, DbClient } from "pstdio-db";
import { createExtensionStorageContext, loadExtensionRuntime } from "pstdio-extensions";
import type { createRepoService } from "./repo-service";

type HarnessProviderServiceDeps = {
  db: DbClient;
  extensionInstancesDBService: ReturnType<typeof createExtensionInstancesDBService>;
  filesRoot: string;
  harnessProviders?: RuntimeHarnessProvider[];
  repoService: ReturnType<typeof createRepoService>;
};

type HarnessRuntime = Awaited<ReturnType<typeof loadExtensionRuntime>>;

export type ResolvedHarnessProvider = {
  provider: RuntimeHarnessProvider;
  context: ExtensionSetupContext;
};

const HARNESS_PREFIX = "pstdio.harness.";

const toHarnessId = (harnessId: string) =>
  harnessId.startsWith(HARNESS_PREFIX) ? harnessId : `${HARNESS_PREFIX}${harnessId}`;

const filterDisabledExtensions = (runtime: HarnessRuntime, disabledExtensionIds: Set<string>) => {
  if (disabledExtensionIds.size === 0) return runtime;

  const isEnabled = (extensionId: string) => !disabledExtensionIds.has(extensionId);

  return {
    ...runtime,
    extensions: runtime.extensions.filter((extension) => isEnabled(extension.id)),
    commands: runtime.commands.filter((command) => isEnabled(command.extensionId)),
    cli: runtime.cli.filter((contribution) => isEnabled(contribution.extensionId)),
    events: runtime.events.filter((event) => isEnabled(event.extensionId)),
    views: runtime.views.filter((view) => isEnabled(view.extensionId)),
    artifactMounts: runtime.artifactMounts.filter((mount) => isEnabled(mount.extensionId)),
    templateTypes: runtime.templateTypes.filter((templateType) => isEnabled(templateType.extensionId)),
    templates: runtime.templates.filter((template) => isEnabled(template.extensionId)),
    skills: runtime.skills.filter((skill) => isEnabled(skill.extensionId)),
    harnesses: runtime.harnesses.filter((harness) => isEnabled(harness.extensionId)),
  };
};

export const createHarnessProviderService = (deps: HarnessProviderServiceDeps) => {
  const loadGlobalRuntime = () =>
    loadExtensionRuntime({ projectRoot: deps.filesRoot || process.cwd(), includeLocal: false });

  const listDisabledExtensionIds = async (projectId: string) => {
    const instances = await deps.extensionInstancesDBService.list(projectId);
    return new Set(instances.filter((instance) => !instance.enabled).map((instance) => instance.extension_id));
  };

  const loadProjectRuntime = async (projectId: string) => {
    const [repo] = await deps.repoService.listByProject(projectId);
    const runtime = repo
      ? await loadExtensionRuntime({ projectRoot: repo.path })
      : await loadExtensionRuntime({ projectRoot: deps.filesRoot || process.cwd(), includeLocal: false });
    const disabledExtensionIds = await listDisabledExtensionIds(projectId);
    return filterDisabledExtensions(runtime, disabledExtensionIds);
  };

  const loadRuntime = (projectId?: string) => (projectId ? loadProjectRuntime(projectId) : loadGlobalRuntime());

  const createContext = (projectId: string | undefined, extensionId: string) => {
    const resolvedProjectId = projectId ?? "";

    return {
      projectId: resolvedProjectId,
      storage: createExtensionStorageContext({
        db: deps.db,
        projectId: resolvedProjectId,
        extensionId,
      }),
      files: {
        readText: (path) => readFile(path, "utf8"),
        writeText: (path, value) => writeFile(path, value),
      },
      repos: {
        list: () => (projectId ? deps.repoService.listByProject(projectId) : Promise.resolve([])),
        getDefault: async () => {
          if (!projectId) throw new Error("Harness provider context requires a project repo.");
          const [repo] = await deps.repoService.listByProject(projectId);
          if (!repo) throw new Error("Harness provider context requires a project repo.");
          return repo;
        },
        resolvePath: async (repoId, relativePath) => {
          const repo = await deps.repoService.get(repoId);
          if (!repo) throw new Error(`Repository not found: ${repoId}`);
          return join(repo.path, relativePath);
        },
      },
      commands: {
        run: async () => {
          throw new Error("Harness provider context cannot run extension commands yet.");
        },
      },
    } satisfies ExtensionSetupContext;
  };

  const list = async (projectId?: string) => {
    const runtime = await loadRuntime(projectId);
    const runtimeProviders = runtime.harnesses.map((provider) => ({
      provider,
      context: createContext(projectId, provider.extensionId),
    }));

    const extraProviders = (deps.harnessProviders ?? []).map((provider) => ({
      provider,
      context: createContext(projectId, provider.extensionId),
    }));

    return [...extraProviders, ...runtimeProviders];
  };

  const resolve = async (harnessId: string, projectId?: string) => {
    const resolvedHarnessId = toHarnessId(harnessId);
    const providers = await list(projectId);
    return providers.find(({ provider }) => provider.id === resolvedHarnessId) ?? null;
  };

  const detect = async ({ provider, context }: ResolvedHarnessProvider) => {
    const result = provider.detect ? await provider.detect(context) : { available: true };
    return {
      type: result.available ? ("INSTALLED" as const) : ("NOT_FOUND" as const),
    };
  };

  return { detect, list, resolve };
};

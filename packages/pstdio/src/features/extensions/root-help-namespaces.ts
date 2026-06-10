import type { ExtensionCommandRecord, ListExtensionCommandsResponse } from "@pstdio/sdk/api";
import { isHealthy as defaultIsHealthy } from "@/adapters/cli/dashboard/health-check";
import { apiClient } from "../api-client";
import { resolveProjectId as defaultResolveProjectId } from "../projects/resolve-project-id";

const stripExtensionScope = (extensionId: string) => extensionId.replace(/^pstdio\./, "");

const aliasNamespace = (alias: string) => alias.split(/\s+/).filter(Boolean)[0] ?? "";

// Root help lists the user-facing alias namespaces an extension exposes (e.g.
// `tickets`, `statuses`), never the extension-id-scoped canonical `cliPath`
// (`pstdio-planner …`). Callers pass the static command names to exclude so core
// groups keep their single listing.
export const extensionNamespaceSummaries = (
  commands: ExtensionCommandRecord[],
  options: { exclude?: Set<string> } = {},
) => {
  const exclude = options.exclude ?? new Set<string>();
  const providers = new Map<string, Set<string>>();

  for (const command of commands) {
    for (const alias of command.cliAliases ?? []) {
      const namespace = aliasNamespace(alias);
      if (!namespace || exclude.has(namespace)) continue;
      const seen = providers.get(namespace) ?? new Set<string>();
      seen.add(stripExtensionScope(command.extensionId));
      providers.set(namespace, seen);
    }
  }

  return Array.from(providers.entries())
    .map(([namespace, names]) => ({
      namespace,
      description: Array.from(names)
        .sort((a, b) => a.localeCompare(b))
        .join(", "),
    }))
    .sort((a, b) => a.namespace.localeCompare(b.namespace));
};

type LoadDeps = {
  cwd: () => string;
  resolveProjectId: (cwd: string, explicitId?: string) => { projectId: string; root: string | null };
  isHealthy: (url: string) => Promise<boolean>;
  listCommands: (projectId: string) => Promise<ListExtensionCommandsResponse>;
};

const defaultDeps = (): LoadDeps => ({
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  isHealthy: defaultIsHealthy,
  listCommands: (projectId) => apiClient().extensions.listCommands(projectId),
});

// Best-effort: root help must keep working offline, so any failure (no project
// context, API unreachable) degrades to an empty list instead of throwing.
export const loadExtensionNamespaces = async (input: {
  healthUrl: string;
  exclude?: Set<string>;
  deps?: Partial<LoadDeps>;
}) => {
  const deps = { ...defaultDeps(), ...input.deps };

  let projectId: string;
  try {
    projectId = deps.resolveProjectId(deps.cwd()).projectId;
  } catch {
    return [];
  }

  if (!(await deps.isHealthy(input.healthUrl))) return [];

  try {
    const metadata = await deps.listCommands(projectId);
    return extensionNamespaceSummaries(metadata.commands, { exclude: input.exclude });
  } catch {
    return [];
  }
};

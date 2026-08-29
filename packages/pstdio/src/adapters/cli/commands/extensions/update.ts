import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getExtensionCatalog } from "pstdio-api/extensions/extension-catalog";
import {
  type InstallExtensionSourceInput,
  type InstalledExtensionSource,
  installExtensionSource,
  readExtensionSourceMetadata,
  resolvePstdioHome,
} from "pstdio-api/extensions/install-extension-source";
import type { Arguments, Argv } from "yargs";
import { CLI_VERSION } from "@/features/cli-version";
import { findGitRoot, readConfig } from "@/features/config/config";
import { ensureApi } from "@/features/ensure-api";
import { enableInstalledExtension } from "./shared";

export const command = "update [name]";
export const describe = "Update managed extensions to the release matching this CLI";

export const builder = (yargs: Argv) =>
  yargs.positional("name", {
    type: "string",
    describe: "Extension install name; updates every managed extension when omitted",
  });

type ExtensionsUpdateArgs = {
  name?: string;
};

type Deps = {
  cwd: () => string;
  enableInstalledExtension: (projectId: string, installed: InstalledExtensionSource) => Promise<unknown>;
  ensureApi: (apiUrl?: string) => Promise<unknown>;
  findGitRoot: typeof findGitRoot;
  getExtensionCatalog: typeof getExtensionCatalog;
  installExtensionSource: (input: InstallExtensionSourceInput) => Promise<InstalledExtensionSource>;
  listInstalledExtensions: (extensionsRoot: string) => string[];
  log: (message: string) => void;
  readConfig: typeof readConfig;
  resolvePstdioHome: typeof resolvePstdioHome;
};

export const listInstalledExtensions = (extensionsRoot: string) => {
  if (!existsSync(extensionsRoot)) return [];
  return readdirSync(extensionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        const installed = readExtensionSourceMetadata(join(extensionsRoot, entry.name));
        return installed.metadata.name === entry.name ? [entry.name] : [];
      } catch {
        return [];
      }
    })
    .sort();
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  enableInstalledExtension,
  ensureApi,
  findGitRoot,
  getExtensionCatalog,
  installExtensionSource,
  listInstalledExtensions,
  log: console.log,
  readConfig,
  resolvePstdioHome,
};

const resolveLinkedProject = (deps: Pick<Deps, "cwd" | "findGitRoot" | "readConfig">) => {
  const root = deps.findGitRoot(deps.cwd());
  if (!root) return null;
  const projectId = deps.readConfig(root)?.project_id;
  return projectId ? { projectId, root } : null;
};

const notManagedMessage = (name: string) =>
  `"${name}" is not a managed extension (no catalog entry). Update it from its source with \`pst extensions add <source> --force\`.`;

const notInstalledMessage = (name: string) =>
  `"${name}" is not installed. Install it with \`pst extensions add ${name}\` before updating it.`;

type UpdateRun = {
  updated: InstalledExtensionSource[];
  skipped: string[];
};

const updateExtension = (deps: Deps, name: string, repoPath: string | undefined) =>
  deps.installExtensionSource({
    source: name,
    installName: name,
    force: true,
    hostReleaseRef: `pstdio@${CLI_VERSION}`,
    reuseInstalledDependencies: true,
    ...(repoPath ? { repoPath } : {}),
  });

const updateAllManaged = async (deps: Deps, names: string[], managed: Set<string>, repoPath: string | undefined) => {
  const run: UpdateRun = { updated: [], skipped: [] };
  for (const name of names) {
    if (!managed.has(name)) {
      run.skipped.push(name);
      continue;
    }
    try {
      run.updated.push(await updateExtension(deps, name, repoPath));
    } catch (error) {
      deps.log(`ERROR: ${name}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
  return run;
};

const enableAllUpdated = async (deps: Deps, projectId: string, installedSources: InstalledExtensionSource[]) => {
  for (const installed of installedSources) {
    try {
      await deps.enableInstalledExtension(projectId, installed);
    } catch (error) {
      deps.log(`ERROR: ${installed.installName}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
};

const registerUpdated = async (deps: Deps, projectId: string, installedSources: InstalledExtensionSource[]) => {
  try {
    await deps.ensureApi(process.env.PSTDIO_API_URL);
  } catch (error) {
    deps.log(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }
  await enableAllUpdated(deps, projectId, installedSources);
};

const reportUpdateRun = (deps: Deps, run: UpdateRun, extensionsRoot: string) => {
  for (const installed of run.updated) {
    const version = installed.metadata.version ? ` to ${installed.metadata.version}` : "";
    deps.log(`Updated ${installed.installName}${version} (${installed.targetPath})`);
  }
  if (run.updated.length === 0 && run.skipped.length === 0) {
    deps.log(`No managed extensions found in ${extensionsRoot}.`);
  }
  if (run.skipped.length > 0) {
    deps.log(
      `Skipped (not managed by the catalog): ${run.skipped.join(", ")}. Update these from their sources with \`pst extensions add <source> --force\`.`,
    );
  }
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsUpdateArgs>) => {
    const catalog = await deps.getExtensionCatalog();
    const managed = new Set(catalog.extensions.map((entry) => entry.installName));
    const project = resolveLinkedProject(deps);
    const extensionsRoot = join(deps.resolvePstdioHome({ env: process.env }), "extensions");
    const installedNames = deps.listInstalledExtensions(extensionsRoot);

    let run: UpdateRun;
    if (argv.name) {
      if (!managed.has(argv.name)) throw new Error(notManagedMessage(argv.name));
      if (!installedNames.includes(argv.name)) throw new Error(notInstalledMessage(argv.name));
      run = { updated: [await updateExtension(deps, argv.name, project?.root)], skipped: [] };
    } else {
      run = await updateAllManaged(deps, installedNames, managed, project?.root);
    }

    if (project && run.updated.length > 0) {
      await registerUpdated(deps, project.projectId, run.updated);
    }

    reportUpdateRun(deps, run, extensionsRoot);
  };

export const handler = createHandler();

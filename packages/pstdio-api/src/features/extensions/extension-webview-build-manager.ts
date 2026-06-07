import { renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { isPackagedRuntime, resolveManagedBunCommand } from "./extension-bun-runner";
import { loadExtensionSource } from "./extension-runtime";
import { type BuildCommandRunner, type CommandResult, defaultRunCommand } from "./extension-webview-build-command";
import { prepareManagedWebviewBuildSource } from "./extension-webview-build-source";
import {
  classifyWebviewEntry,
  collectExtensionWebviews,
  resolveManagedWebviewPaths,
  resolvePackageAssetFile,
} from "./extension-webviews";
import { resolvePstdioHome } from "./install-extension-source";

type InstalledSourceWithManifest = {
  install_name: string;
  source_hash?: string | null;
  source_path: string;
};

type ExpectedWebviewBuildSource = {
  sourceHash?: string | null;
  sourcePath: string;
};

type ManagedCommand = {
  args: string[];
  env: NodeJS.ProcessEnv;
  file: string;
};

export type ExtensionWebviewBuildManager = {
  dispose: () => void;
  refresh: () => Promise<void>;
};

export type CreateExtensionWebviewBuildManagerInput = {
  bunCacheDir?: string;
  env?: NodeJS.ProcessEnv;
  isPackaged?: boolean;
  listInstalledSources: () => Promise<InstalledSourceWithManifest[]>;
  onError?: (error: unknown) => void;
  processExecPath?: string;
  reportBuildFailure: (
    installName: string,
    webviewId: string,
    error: unknown,
    expectedSource: ExpectedWebviewBuildSource,
  ) => Promise<unknown>;
  reportBuildSuccess: (
    installName: string,
    webviewId: string,
    expectedSource: ExpectedWebviewBuildSource,
  ) => Promise<unknown>;
  runCommand?: BuildCommandRunner;
  webviewCacheRoot?: string;
};

const defaultBunCacheDir = (env: NodeJS.ProcessEnv) =>
  join(resolvePstdioHome({ env }), "cache", "extension-bun-install");

const defaultWebviewCacheRoot = (env: NodeJS.ProcessEnv) =>
  join(resolvePstdioHome({ env }), "cache", "extension-webviews");

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const resolveManagedWebviewBuildCommand = (input: {
  args: string[];
  bunCacheDir: string;
  env: NodeJS.ProcessEnv;
  isPackaged: boolean;
  processExecPath: string;
}): ManagedCommand =>
  resolveManagedBunCommand({
    args: input.args,
    bunCacheDir: input.bunCacheDir,
    env: input.env,
    isPackaged: input.isPackaged,
    processExecPath: input.processExecPath,
  });

// We bundle each extension's webview entry as a single ESM module — no HTML wrapper. The
// dashboard host loads a separate bridge runtime (served by the API) that connects via
// rimless RPC, applies the host's theme variables, and dynamically imports this module.
const buildArgs = (entryPath: string, distDir: string) => [
  "build",
  entryPath,
  "--outdir",
  distDir,
  "--target",
  "browser",
  "--format",
  "esm",
  "--entry-naming",
  "module.[ext]",
  "--asset-naming",
  "[name]-[hash].[ext]",
];

const processKey = (installName: string, webviewId: string) => `${installName}\0${webviewId}`;

const signatureFor = (row: InstalledSourceWithManifest, webviewId: string, entryPath: string) =>
  [row.source_path, row.source_hash ?? "", webviewId, entryPath].join("\0");

const buildFailure = (installName: string, webviewId: string, details: string) =>
  new Error(`Webview build failed for ${installName}/${webviewId}${details ? `: ${details}` : ""}`);

export const createExtensionWebviewBuildManager = (
  input: CreateExtensionWebviewBuildManagerInput,
): ExtensionWebviewBuildManager => {
  const built = new Map<string, string>();
  let disposed = false;
  let refreshQueue = Promise.resolve();
  const env = input.env ?? process.env;
  const runCommand = input.runCommand ?? defaultRunCommand;
  const bunCacheDir = input.bunCacheDir ?? defaultBunCacheDir(env);
  const isPackaged = input.isPackaged ?? isPackagedRuntime();
  const processExecPath = input.processExecPath ?? process.execPath;
  const webviewCacheRoot = input.webviewCacheRoot ?? defaultWebviewCacheRoot(env);

  const reportFailure = async (
    installName: string,
    webviewId: string,
    error: unknown,
    expectedSource: ExpectedWebviewBuildSource,
  ) => {
    try {
      await input.reportBuildFailure(installName, webviewId, error, expectedSource);
    } catch (reportError) {
      input.onError?.(reportError);
    }
  };

  const reportSuccess = async (installName: string, webviewId: string, expectedSource: ExpectedWebviewBuildSource) => {
    try {
      await input.reportBuildSuccess(installName, webviewId, expectedSource);
      return true;
    } catch (reportError) {
      input.onError?.(reportError);
      return false;
    }
  };

  const managedCommand = (args: string[]) =>
    resolveManagedWebviewBuildCommand({ args, bunCacheDir, env, isPackaged, processExecPath });

  const buildOnce = async (
    row: InstalledSourceWithManifest,
    webviewId: string,
    entryPath: string,
    distDir: string,
    cwd: string,
  ) => {
    const command = managedCommand(buildArgs(entryPath, distDir));
    let result: CommandResult;
    try {
      result = await runCommand(command.file, command.args, { cwd, env: command.env });
    } catch (error) {
      if (!disposed) {
        await reportFailure(
          row.install_name,
          webviewId,
          buildFailure(row.install_name, webviewId, errorMessage(error)),
          {
            sourceHash: row.source_hash,
            sourcePath: row.source_path,
          },
        );
      }
      return false;
    }

    if (result.exitCode === 0) {
      return true;
    }

    const details = result.stderr.trim() || result.stdout.trim();
    if (!disposed) {
      await reportFailure(row.install_name, webviewId, buildFailure(row.install_name, webviewId, details), {
        sourceHash: row.source_hash,
        sourcePath: row.source_path,
      });
    }
    return false;
  };

  // First-open cost is dominated by cold `bun build` processes, so build a
  // source's webviews concurrently instead of one after another.
  const refreshRow = async (row: InstalledSourceWithManifest, active: Set<string>) => {
    if (disposed) return;

    const loaded = await loadExtensionSource(row.source_path);
    const managedWebviews = collectExtensionWebviews(loaded).filter(
      (webview) => classifyWebviewEntry(webview.entry).kind === "managed",
    );

    const buildResults = await Promise.all(
      managedWebviews.map(async (webview) => {
        const key = processKey(row.install_name, webview.id);
        active.add(key);
        const signature = signatureFor(row, webview.id, webview.entry.path);
        if (built.get(key) === signature) return { builtNow: false, key, signature, webviewId: webview.id };

        built.delete(key);
        const paths = resolveManagedWebviewPaths({
          installName: row.install_name,
          webviewCacheRoot,
          webviewId: webview.id,
        });
        const stageDir = `${paths.distDir}.staging-${crypto.randomUUID()}`;
        rmSync(stageDir, { recursive: true, force: true });
        const sourceEntryPath = resolvePackageAssetFile(webview.entry);
        const buildSource = prepareManagedWebviewBuildSource({
          entryPath: sourceEntryPath,
          installName: row.install_name,
          packageName: loaded.metadata.name,
          packagePath: row.source_path,
          shellDir: paths.shellDir,
        });
        if (!(await buildOnce(row, webview.id, buildSource.entryPath, stageDir, buildSource.cwd))) {
          rmSync(stageDir, { recursive: true, force: true });
          return null;
        }
        if (disposed) {
          rmSync(stageDir, { recursive: true, force: true });
          return null;
        }
        return { builtNow: true, distDir: paths.distDir, key, signature, stageDir, webviewId: webview.id };
      }),
    );
    const removeStagedBuilds = () => {
      for (const result of buildResults) {
        if (result?.stageDir) rmSync(result.stageDir, { recursive: true, force: true });
      }
    };

    const completedBuilds = buildResults.filter((result): result is NonNullable<typeof result> => result !== null);
    if (disposed || completedBuilds.length !== managedWebviews.length) {
      removeStagedBuilds();
      return;
    }
    if (!completedBuilds.some((result) => result.builtNow)) return;
    for (const result of completedBuilds) {
      if (!result.builtNow && built.get(result.key) !== result.signature) return;
    }
    let currentRow: InstalledSourceWithManifest | undefined;
    try {
      const currentRows = await input.listInstalledSources();
      currentRow = currentRows.find((current) => current.install_name === row.install_name);
    } catch (error) {
      removeStagedBuilds();
      throw error;
    }
    if (currentRow?.source_hash !== row.source_hash || currentRow?.source_path !== row.source_path) {
      removeStagedBuilds();
      return;
    }
    for (const result of completedBuilds) {
      if (!result.builtNow || !result.distDir || !result.stageDir) continue;
      rmSync(result.distDir, { recursive: true, force: true });
      renameSync(result.stageDir, result.distDir);
    }
    const expectedSource = { sourceHash: row.source_hash, sourcePath: row.source_path };
    for (const result of completedBuilds) {
      if (!result.builtNow) continue;
      if (await reportSuccess(row.install_name, result.webviewId, expectedSource)) {
        built.set(result.key, result.signature);
      }
    }
  };

  const refreshNow = async () => {
    if (disposed) return;

    const active = new Set<string>();
    const rows = await input.listInstalledSources();

    await Promise.all(
      rows.map(async (row) => {
        if (disposed) return;
        try {
          await refreshRow(row, active);
        } catch (error) {
          input.onError?.(error);
        }
      }),
    );

    for (const key of built.keys()) {
      if (active.has(key)) continue;

      built.delete(key);
      const [installName, webviewId] = key.split("\0");
      if (installName && webviewId) {
        const paths = resolveManagedWebviewPaths({ installName, webviewCacheRoot, webviewId });
        rmSync(paths.distDir, { recursive: true, force: true });
      }
    }
  };

  const refresh = () => {
    const nextRefresh = refreshQueue.then(refreshNow, refreshNow);
    refreshQueue = nextRefresh.catch(() => {});
    return nextRefresh;
  };

  const dispose = () => {
    disposed = true;
    built.clear();
  };

  return { dispose, refresh };
};

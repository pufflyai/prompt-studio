import { spawn as nodeSpawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { isPackagedRuntime, resolveManagedBunCommand } from "./extension-bun-runner";
import { loadExtensionSource } from "./extension-runtime";
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

type ManagedCommand = {
  args: string[];
  env: NodeJS.ProcessEnv;
  file: string;
};

type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

type BuildChildProcess = {
  kill?: (signal?: NodeJS.Signals | number) => boolean;
  on: (event: string, listener: (...args: unknown[]) => void) => BuildChildProcess;
};

type BuildSpawner = (
  file: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; stdio: "ignore" },
) => BuildChildProcess;

type BuildCommandRunner = (
  file: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<CommandResult>;

type ManagedProcess = {
  child: BuildChildProcess;
  signature: string;
  stopping: boolean;
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
  reportBuildFailure: (installName: string, webviewId: string, error: unknown) => Promise<unknown>;
  reportBuildSuccess: (installName: string, webviewId: string) => Promise<unknown>;
  runCommand?: BuildCommandRunner;
  spawn?: BuildSpawner;
  webviewCacheRoot?: string;
};

const defaultBunCacheDir = (env: NodeJS.ProcessEnv) =>
  join(resolvePstdioHome({ env }), "cache", "extension-bun-install");

const defaultWebviewCacheRoot = (env: NodeJS.ProcessEnv) =>
  join(resolvePstdioHome({ env }), "cache", "extension-webviews");

const defaultSpawn: BuildSpawner = (file, args, options) => nodeSpawn(file, args, options);

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const defaultRunCommand: BuildCommandRunner = (file, args, options) =>
  new Promise((resolveResult) => {
    let child: ReturnType<typeof nodeSpawn>;
    try {
      child = nodeSpawn(file, args, { cwd: options.cwd, env: options.env, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      resolveResult({ exitCode: 1, stdout: "", stderr: errorMessage(error) });
      return;
    }

    if (!child.stdout || !child.stderr) {
      child.kill("SIGKILL");
      resolveResult({ exitCode: 1, stdout: "", stderr: "Failed to start webview build command." });
      return;
    }

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => resolveResult({ exitCode: 1, stdout: "", stderr: error.message }));
    child.on("close", (code) => {
      resolveResult({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });

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
const buildArgs = (entryPath: string, distDir: string, watch: boolean) => [
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
  "--no-clear-screen",
  ...(watch ? ["--watch"] : []),
];

const processKey = (installName: string, webviewId: string) => `${installName}\0${webviewId}`;

const signatureFor = (row: InstalledSourceWithManifest, webviewId: string, entryPath: string) =>
  [row.source_path, row.source_hash ?? "", webviewId, entryPath].join("\0");

const buildFailure = (installName: string, webviewId: string, details: string) =>
  new Error(`Webview build failed for ${installName}/${webviewId}${details ? `: ${details}` : ""}`);

const watchFailure = (installName: string, webviewId: string, code: unknown) =>
  new Error(`Webview build watch for ${installName}/${webviewId} exited with code ${String(code ?? "unknown")}`);

export const createExtensionWebviewBuildManager = (
  input: CreateExtensionWebviewBuildManagerInput,
): ExtensionWebviewBuildManager => {
  const processes = new Map<string, ManagedProcess>();
  let disposed = false;
  let refreshQueue = Promise.resolve();
  const env = input.env ?? process.env;
  const spawn = input.spawn ?? defaultSpawn;
  const runCommand = input.runCommand ?? defaultRunCommand;
  const bunCacheDir = input.bunCacheDir ?? defaultBunCacheDir(env);
  const isPackaged = input.isPackaged ?? isPackagedRuntime();
  const processExecPath = input.processExecPath ?? process.execPath;
  const webviewCacheRoot = input.webviewCacheRoot ?? defaultWebviewCacheRoot(env);

  const stop = (key: string) => {
    const managed = processes.get(key);
    if (!managed) return;

    managed.stopping = true;
    managed.child.kill?.("SIGKILL");
    processes.delete(key);
  };

  const reportFailure = (installName: string, webviewId: string, error: unknown) => {
    input.reportBuildFailure(installName, webviewId, error).catch((reportError) => input.onError?.(reportError));
  };

  const reportSuccess = (installName: string, webviewId: string) => {
    input.reportBuildSuccess(installName, webviewId).catch((reportError) => input.onError?.(reportError));
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
    const command = managedCommand(buildArgs(entryPath, distDir, false));
    let result: CommandResult;
    try {
      result = await runCommand(command.file, command.args, { cwd, env: command.env });
    } catch (error) {
      if (!disposed) {
        reportFailure(row.install_name, webviewId, buildFailure(row.install_name, webviewId, errorMessage(error)));
      }
      return false;
    }

    if (result.exitCode === 0) {
      if (!disposed) reportSuccess(row.install_name, webviewId);
      return true;
    }

    const details = result.stderr.trim() || result.stdout.trim();
    if (!disposed) reportFailure(row.install_name, webviewId, buildFailure(row.install_name, webviewId, details));
    return false;
  };

  const startWatch = (
    row: InstalledSourceWithManifest,
    webviewId: string,
    signature: string,
    entryPath: string,
    distDir: string,
    cwd: string,
  ) => {
    if (disposed) return;

    const command = managedCommand(buildArgs(entryPath, distDir, true));
    let child: BuildChildProcess;
    try {
      child = spawn(command.file, command.args, { cwd, env: command.env, stdio: "ignore" });
    } catch (error) {
      reportFailure(row.install_name, webviewId, error);
      return;
    }

    const managed: ManagedProcess = { child, signature, stopping: false };
    const key = processKey(row.install_name, webviewId);

    child.on("error", (error) => {
      if (managed.stopping) return;
      processes.delete(key);
      reportFailure(row.install_name, webviewId, error);
    });
    child.on("close", (code) => {
      if (managed.stopping) return;
      processes.delete(key);
      reportFailure(row.install_name, webviewId, watchFailure(row.install_name, webviewId, code));
    });

    processes.set(key, managed);
  };

  const refreshRow = async (row: InstalledSourceWithManifest, active: Set<string>) => {
    if (disposed) return;

    const loaded = await loadExtensionSource(row.source_path);
    const webviews = collectExtensionWebviews(loaded);

    for (const webview of webviews) {
      if (classifyWebviewEntry(webview.entry).kind !== "managed") continue;

      const key = processKey(row.install_name, webview.id);
      active.add(key);
      const signature = signatureFor(row, webview.id, webview.entry.path);
      const existing = processes.get(key);
      if (existing?.signature === signature) continue;

      stop(key);
      const paths = resolveManagedWebviewPaths({
        installName: row.install_name,
        webviewCacheRoot,
        webviewId: webview.id,
      });
      rmSync(paths.distDir, { recursive: true, force: true });
      const sourceEntryPath = resolvePackageAssetFile(webview.entry);
      const buildSource = prepareManagedWebviewBuildSource({
        entryPath: sourceEntryPath,
        installName: row.install_name,
        packageName: loaded.metadata.name,
        packagePath: row.source_path,
        shellDir: paths.shellDir,
      });
      if (!(await buildOnce(row, webview.id, buildSource.entryPath, paths.distDir, buildSource.cwd))) continue;
      if (disposed) return;
      startWatch(row, webview.id, signature, buildSource.entryPath, paths.distDir, buildSource.cwd);
    }
  };

  const refreshNow = async () => {
    if (disposed) return;

    const active = new Set<string>();

    for (const row of await input.listInstalledSources()) {
      if (disposed) return;
      try {
        await refreshRow(row, active);
      } catch (error) {
        input.onError?.(error);
      }
    }

    for (const key of processes.keys()) {
      if (!active.has(key)) stop(key);
    }
  };

  const refresh = () => {
    const nextRefresh = refreshQueue.then(refreshNow, refreshNow);
    refreshQueue = nextRefresh.catch(() => {});
    return nextRefresh;
  };

  const dispose = () => {
    disposed = true;
    for (const key of [...processes.keys()]) stop(key);
  };

  return { dispose, refresh };
};

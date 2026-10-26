import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionInstallEnvironment } from "pstdio-extensions";
import { resolvePstdioHome } from "pstdio-paths";
import { traceSetupPhase } from "../../lib/setup-phase";
import { isPackagedRuntime, resolveManagedBunCommand } from "./extension-bun-runner";
import { resolveProcessCommand } from "./process-command";

export type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export type CommandOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
};

export type DependencyInstallInput = {
  bunCacheDir?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  homedir?: () => string;
  isPackagedRuntime?: () => boolean;
  processExecPath?: string;
  // Installs only `dependencies`. The host passes it for the copies it owns; a source checkout
  // belongs to its author and keeps its development dependencies.
  production?: boolean;
  runCommand?: (command: string, args: string[], options: CommandOptions) => Promise<CommandResult>;
  signal?: AbortSignal;
};

// File capture removes Bun 1.4.2's crashing Windows output-pipe lifecycle (ADR 0086).
export const runCommand = async (command: string, args: string[], options: CommandOptions) => {
  try {
    options.signal?.throwIfAborted();
    const resolved = resolveProcessCommand([command, ...args]);
    const outputRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-command-"));
    const startedAt = Date.now();
    const packageCount = (path: string) => existsSync(path) ? readdirSync(path).length : 0;
    const progress = setInterval(() => {
      console.log(JSON.stringify({event:"install.progress",cwd:options.cwd,elapsedMs:Date.now()-startedAt,cachePackages:packageCount(options.env?.BUN_INSTALL_CACHE_DIR ?? ""),installedPackages:packageCount(join(options.cwd,"node_modules",".bun")),stderr:existsSync(join(outputRoot,"stderr"))?readFileSync(join(outputRoot,"stderr"),"utf8").slice(-1000):""}));
    }, 2000);
    progress.unref();
    try {
      const stdoutFile = Bun.file(join(outputRoot, "stdout"));
      const stderrFile = Bun.file(join(outputRoot, "stderr"));
      const child = Bun.spawn(resolved.argv, {
        cwd: options.cwd,
        env: options.env,
        signal: options.signal,
        stdin: "ignore",
        stdout: stdoutFile,
        stderr: stderrFile,
        windowsHide: true,
        windowsVerbatimArguments: resolved.windowsVerbatimArguments,
      });
      const exitCode = await child.exited;
      const [stdout, stderr] = await Promise.all([stdoutFile.text(), stderrFile.text()]);
      console.log(JSON.stringify({event:"install.output",cwd:options.cwd,elapsedMs:Date.now()-startedAt,exitCode,stdout,stderr}));
      return { exitCode, stdout, stderr };
    } finally {
      clearInterval(progress);
      rmSync(outputRoot, { recursive: true, force: true });
    }
  } catch (error) {
    return { exitCode: 1, stdout: "", stderr: error instanceof Error ? error.message : String(error) };
  }
};

const declaredRuntimeDependencies = (targetPath: string) => {
  const packageJsonPath = join(targetPath, "package.json");
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, unknown>;
  };
  return Object.keys(parsed.dependencies ?? {});
};

const dependencyPath = (nodeModulesPath: string, dependencyName: string) =>
  dependencyName.startsWith("@")
    ? join(nodeModulesPath, ...dependencyName.split("/"))
    : join(nodeModulesPath, dependencyName);

// Re-run dep install whenever direct runtime deps are missing. The reuse-existing path used to skip
// this entirely, so an interrupted install or copied broken node_modules left extensions unbuildable.
export const shouldInstallDependencies = (targetPath: string) => {
  if (!existsSync(join(targetPath, "package.json"))) return false;
  const nodeModulesPath = join(targetPath, "node_modules");
  if (!existsSync(nodeModulesPath)) return true;
  return declaredRuntimeDependencies(targetPath).some(
    (dependencyName) => !existsSync(dependencyPath(nodeModulesPath, dependencyName)),
  );
};

// Prompt Studio installs extension dependencies with bun only: a packaged build runs the bundled bun
// (the compiled pstdio binary), and from-source runs bun on PATH. Extensions never choose a package
// manager — bun installs npm-published packages fine and reuses the warm bun cache.
//
// Installing never runs package code. `--ignore-scripts` skips lifecycle scripts of the package and
// of every dependency, including `trustedDependencies`, so an install cannot run code before the
// host validates the extension. `--frozen-lockfile` installs exactly what a shipped `bun.lock`
// names and refuses a lockfile that no longer matches `package.json`. It never writes a lockfile.
export const installDependencies = async (targetPath: string, input: DependencyInstallInput) => {
  if (!existsSync(join(targetPath, "package.json"))) return;

  const run = input.runCommand ?? runCommand;
  const packaged = (input.isPackagedRuntime ?? isPackagedRuntime)();
  const env = createExtensionInstallEnvironment(input.env ?? process.env);
  const args = ["install", "--frozen-lockfile", "--ignore-scripts", ...(input.production ? ["--production"] : [])];
  const command = packaged
    ? resolveManagedBunCommand({
        args,
        bunCacheDir: input.bunCacheDir ?? join(resolvePstdioHome(input), "cache", "extension-bun-install"),
        env,
        isPackaged: true,
        processExecPath: input.processExecPath ?? process.execPath,
      })
    : { file: "bun", args, env };

  await traceSetupPhase("extension.dependencies", {}, async () => {
    const result = await run(command.file, command.args, {
      cwd: targetPath,
      ...(command.env ? { env: command.env } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    });
    if (result.exitCode !== 0) {
      const details = result.stderr.trim() || result.stdout.trim();
      throw new Error(`Dependency install failed${details ? `: ${details}` : ""}`);
    }
  });
};

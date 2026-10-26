import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const commandId = crypto.randomUUID();
  const marks: { phase: string; at: number }[] = [];
  const mark = (phase: string) => marks.push({ phase, at: performance.now() });
  mark("entered");
  let childPid: number | undefined;
  let actualArgv = [command, ...args];
  let artifactPath: string | undefined;
  const hashes = Object.fromEntries(
    ["package.json", "bun.lock"].map((name) => {
      const path = join(options.cwd, name);
      return [name, existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : null];
    }),
  );
  const cacheRoot = options.env?.BUN_INSTALL_CACHE_DIR;
  const cacheExistedAtEntry = cacheRoot ? existsSync(cacheRoot) : null;
  try {
    options.signal?.throwIfAborted();
    mark("resolve-start");
    const resolved = resolveProcessCommand([command, ...args]);
    actualArgv = resolved.argv;
    mark("resolve-done");
    const outputRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-command-"));
    if (process.env.E2E_INSTALL_PROFILE_ROOT) artifactPath = join(process.env.E2E_INSTALL_PROFILE_ROOT, commandId);
    mark("capture-root-created");
    try {
      const stdoutFile = Bun.file(join(outputRoot, "stdout"));
      const stderrFile = Bun.file(join(outputRoot, "stderr"));
      mark("spawn-start");
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
      childPid = child.pid;
      mark("spawn-returned");
      const exitCode = await child.exited;
      mark("exit-observed");
      const [stdout, stderr] = await Promise.all([stdoutFile.text(), stderrFile.text()]);
      mark("capture-read-done");
      console.log("Native package manager result", JSON.stringify({ commandId, exitCode, stdout, stderr }));
      return { exitCode, stdout, stderr };
    } finally {
      mark("capture-backup-start");
      if (artifactPath) {
        mkdirSync(artifactPath, { recursive: true });
        cpSync(outputRoot, artifactPath, { recursive: true });
      }
      mark("capture-backup-done");
      mark("capture-cleanup-start");
      rmSync(outputRoot, { recursive: true, force: true });
      mark("capture-cleanup-done");
    }
  } catch (error) {
    return { exitCode: 1, stdout: "", stderr: error instanceof Error ? error.message : String(error) };
  } finally {
    const record = {
      commandId,
      childPid,
      actualArgv,
      cwd: options.cwd,
      marks,
      hashes,
      cacheRoot,
      cacheExistedAtEntry,
      parentBun: Bun.version,
      bunBeBun: options.env?.BUN_BE_BUN,
    };
    console.log("Native package manager timing", JSON.stringify(record));
    if (artifactPath) writeFileSync(join(artifactPath, "timing.json"), JSON.stringify(record));
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

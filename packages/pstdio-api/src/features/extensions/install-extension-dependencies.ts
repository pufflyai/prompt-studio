import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import { isPackagedRuntime, resolveManagedBunCommand } from "./extension-bun-runner";

const PACKAGE_MANAGERS = ["bun", "npm", "yarn"] as const;

type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export type DependencyInstallInput = {
  bunCacheDir?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  homedir?: () => string;
  isCommandAvailable?: (command: string) => boolean | Promise<boolean>;
  isPackagedRuntime?: () => boolean;
  processExecPath?: string;
  runCommand?: (
    command: string,
    args: string[],
    options: { cwd: string; env?: NodeJS.ProcessEnv },
  ) => Promise<CommandResult>;
};

export const runCommand = (command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }) =>
  new Promise<CommandResult>((resolveResult) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      resolveResult({ exitCode: 1, stdout: "", stderr: error.message });
    });
    child.on("close", (code) => {
      resolveResult({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });

const isCommandAvailable = async (command: string) => {
  if (typeof Bun.which === "function") return Bun.which(command) !== null;
  const result = await runCommand(command, ["--version"], { cwd: process.cwd() });
  return result.exitCode === 0;
};

const packageManagerFromPackageJson = (targetPath: string) => {
  const packageJsonPath = join(targetPath, "package.json");
  if (!existsSync(packageJsonPath)) return null;

  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { packageManager?: string };
  const declared = parsed.packageManager?.split("@")[0];
  return PACKAGE_MANAGERS.find((manager) => manager === declared) ?? null;
};

const packageManagerFromLockfile = (targetPath: string): PackageManager => {
  if (existsSync(join(targetPath, "bun.lock")) || existsSync(join(targetPath, "bun.lockb"))) return "bun";
  if (existsSync(join(targetPath, "yarn.lock"))) return "yarn";
  return "npm";
};

const selectPackageManager = async (targetPath: string, available: (command: string) => boolean | Promise<boolean>) => {
  const preferred = packageManagerFromPackageJson(targetPath) ?? packageManagerFromLockfile(targetPath);
  if (await available(preferred)) return preferred;

  for (const manager of PACKAGE_MANAGERS) {
    if (await available(manager)) return manager;
  }

  throw new Error("No package manager found on PATH. Install bun, yarn, or npm, or re-run with --skip-install.");
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

export const installDependencies = async (targetPath: string, input: DependencyInstallInput) => {
  if (!existsSync(join(targetPath, "package.json"))) return;

  const run = input.runCommand ?? runCommand;
  const packaged = (input.isPackagedRuntime ?? isPackagedRuntime)();
  const manager = packaged
    ? "bun"
    : await selectPackageManager(targetPath, input.isCommandAvailable ?? isCommandAvailable);
  const command = packaged
    ? resolveManagedBunCommand({
        args: ["install"],
        bunCacheDir: input.bunCacheDir ?? join(resolvePstdioHome(input), "cache", "extension-bun-install"),
        env: (input.env ?? process.env) as NodeJS.ProcessEnv,
        isPackaged: true,
        processExecPath: input.processExecPath ?? process.execPath,
      })
    : { file: manager, args: ["install"], env: undefined };

  const result = await run(command.file, command.args, {
    cwd: targetPath,
    ...(command.env ? { env: command.env } : {}),
  });
  if (result.exitCode !== 0) {
    const details = result.stderr.trim() || result.stdout.trim();
    throw new Error(`Dependency install failed with ${manager}${details ? `: ${details}` : ""}`);
  }
};

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const omitted = new Set([".git", "node_modules"]);
const inside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
};

const validateLocalDependencies = (root: string, path: string, directory: string) => {
  let manifest: Record<string, Record<string, unknown> | undefined> | null;
  try {
    manifest = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // The production installer owns malformed manifest diagnostics.
    return;
  }
  if (!manifest) return;
  for (const specifier of Object.values({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  })) {
    if (typeof specifier !== "string") continue;
    if (!/^(file:|link:|\.\.?\/|\/|[A-Za-z]:[\\/])/.test(specifier)) continue;
    const target = specifier.replace(/^(file:|link:)/, "");
    const dependency = resolve(directory, target);
    if (isAbsolute(target) || !existsSync(dependency) || !inside(root, realpathSync(dependency))) {
      throw new Error(
        `Local dependency ${specifier} in ${path} cannot be isolated. Use relative dependencies and --project-path containing their context.`,
      );
    }
  }
};

const validateContext = (root: string, directory = root) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (omitted.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      if (!inside(root, realpathSync(path)))
        throw new Error(`Symlink outside disposable context: ${path}. Supply its context with --project-path.`);
      // Absolute links would still point at the caller after copying.
      throw new Error(`Source symlinks are not supported: ${path}. Supply ordinary files inside --project-path.`);
    }
    if (entry.isDirectory()) validateContext(root, path);
    if (entry.name !== "package.json" || !entry.isFile()) continue;
    validateLocalDependencies(root, path, directory);
  }
};

export const createSmokeContext = async (input: { source: string; projectPath?: string; env?: NodeJS.ProcessEnv }) => {
  const source = realpathSync(resolve(input.source));
  if (!lstatSync(source).isDirectory()) throw new Error("Extension source must be a local directory.");
  const context = input.projectPath ? realpathSync(resolve(input.projectPath)) : source;
  if (!inside(context, source))
    throw new Error("--project-path must contain the extension source and its local dependencies.");
  validateContext(context);
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-extension-test-")));
  try {
    const home = join(root, "home");
    const project = join(root, "project");
    const staged = join(root, "inputs");
    const copy = (destination: string) =>
      cpSync(context, destination, {
        recursive: true,
        filter: (path) => {
          const parts = relative(context, path).split(/[\\/]/);
          if (parts.some((part) => omitted.has(part))) return false;
          const state = parts.indexOf(".pstdio");
          if (state < 0) return true;
          if (parts[state + 1] === "config.json") return false;
          return destination !== project || parts[state + 1] !== "extensions";
        },
      });
    mkdirSync(home);
    copy(staged);
    if (input.projectPath) copy(project);
    else mkdirSync(project);
    const env: NodeJS.ProcessEnv = Object.fromEntries(
      Object.entries(input.env ?? process.env).filter(
        ([key]) =>
          !key.startsWith("PSTDIO_") &&
          !key.startsWith("GIT_") &&
          !key.startsWith("BUN_") &&
          !["NODE_OPTIONS", "INIT_CWD", "PWD"].includes(key),
      ),
    );
    Object.assign(env, {
      HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: join(home, "config"),
      XDG_CACHE_HOME: join(home, "cache"),
      PSTDIO_HOME: home,
      PSTDIO_DB_PATH: ":memory:",
      PSTDIO_STORAGE_PATH: join(home, "storage"),
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      BUN_INSTALL_CACHE_DIR: join(home, "bun-cache"),
    });
    const git = spawnSync("git", ["init", "--quiet", project], { env, encoding: "utf8" });
    if (git.status !== 0) throw new Error(`Cannot create scratch Git repository: ${git.stderr}`);
    return { root, home, project, source: join(staged, relative(context, source)), env };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
};

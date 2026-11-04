import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";

const pathFor = (env: Record<string, string | undefined>) =>
  join(resolvePstdioHome({ env }), "default-extension-removals.json");
export const isHostExtensionSource = (
  source: { install_name: string; source_path: string },
  env: Record<string, string | undefined> = process.env,
) => resolve(source.source_path) === resolve(join(resolvePstdioHome({ env }), "extensions", source.install_name));

const pending = new Map<string, Promise<unknown>>();

// Deliberate source removal is host install policy, not a project disable or transient queue result.
export const readDefaultExtensionRemovals = async (env: Record<string, string | undefined> = process.env) => {
  try {
    return new Set<string>(JSON.parse(await readFile(pathFor(env), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set<string>();
    throw error;
  }
};

export const setDefaultExtensionRemoved = (
  installName: string,
  removed: boolean,
  env: Record<string, string | undefined> = process.env,
) => {
  const path = pathFor(env);
  const operation = (pending.get(path) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const names = await readDefaultExtensionRemovals(env);
      if (names.has(installName) === removed) return;
      if (removed) names.add(installName);
      else names.delete(installName);
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${crypto.randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify([...names].sort()));
      await rename(temporary, path);
    });
  pending.set(path, operation);
  void operation
    .finally(() => {
      if (pending.get(path) === operation) pending.delete(path);
    })
    .catch(() => {});
  return operation;
};

import { chmod, cp, mkdir, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { createExtensionIgnoreMatcher } from "./extension-ignore";

/** Keep the source intact while staging an install, including shared named checkouts. */
export const copyExtensionSource = async (sourcePath: string, targetPath: string) => {
  const matcher = createExtensionIgnoreMatcher(sourcePath, { ignoreGit: false });
  const directories: { path: string; mode: number }[] = [];
  const include = (path: string) => {
    const rel = relative(sourcePath, path).replaceAll("\\", "/");
    if (rel === ".git" || rel.startsWith(".git/")) return true;
    if (rel === "node_modules" || rel.startsWith("node_modules/")) return false;
    return !matcher.ignores(rel);
  };
  async function* files(source: string, target: string): AsyncGenerator<{ source: string; target: string }> {
    // Apply source directory permissions after every leaf copy has completed.
    await mkdir(target, { recursive: true });
    directories.push({ path: target, mode: (await stat(source)).mode });
    for (const entry of await readdir(source, { withFileTypes: true })) {
      const from = join(source, entry.name);
      if (!include(from)) continue;
      const to = join(target, entry.name);
      if (entry.isDirectory()) yield* files(from, to);
      else yield { source: from, target: to };
    }
  }
  const entries = files(sourcePath, targetPath);
  // Node's recursive cp copies leaves serially. Bound independent leaf copies so
  // large source trees do not spend the cold install waiting on each file in turn.
  const workers = Array.from({ length: 8 }, async () => {
    for await (const entry of entries) await cp(entry.source, entry.target);
  });
  // Drain writes before the caller may remove a failed staging directory.
  const results = await Promise.allSettled(workers);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  for (const directory of directories.reverse()) await chmod(directory.path, directory.mode);
};

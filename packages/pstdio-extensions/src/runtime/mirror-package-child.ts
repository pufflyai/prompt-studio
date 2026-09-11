import { copyFileSync, lstatSync, readlinkSync, realpathSync, type Stats, statSync, symlinkSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

/**
 * Mirror a single package child (file or directory) from a source tree into the
 * runtime cache.
 *
 * Real directories become junctions. Everything else is symlinked so the cache
 * doesn't duplicate content or lose permission bits like the executable flag —
 * except on Windows, which can't create file symlinks without elevated
 * privileges, so there we copy plain files and follow symlinks to whatever they
 * resolve to.
 *
 * Shared by the loader's `node_modules` mirror and the runtime source snapshot
 * so the Windows carve-out only ever lives in one place.
 */
export const mirrorPackageChild = (sourcePath: string, targetPath: string) => {
  const linkStats = lstatSync(sourcePath);

  if (process.platform !== "win32") {
    if (linkStats.isDirectory()) {
      symlinkSync(sourcePath, targetPath, "junction");
      return;
    }

    // Matches the pre-Windows behavior: plain files and symlinks (even dangling
    // ones) are symlinked without dereferencing the target.
    symlinkSync(sourcePath, targetPath, "file");
    return;
  }

  // A real directory: a junction is enough and cheap.
  if (linkStats.isDirectory()) {
    symlinkSync(sourcePath, targetPath, "junction");
    return;
  }

  // A real file: Windows can't symlink it without privileges, so copy it.
  if (!linkStats.isSymbolicLink()) {
    copyFileSync(sourcePath, targetPath);
    return;
  }

  // A symlink. Workspace installers point package entries at an absolute store
  // path (e.g. node_modules/.bun/<pkg>@<version>/node_modules/<pkg>), and the
  // staged source often reaches that entry through a junction. Windows will not
  // reliably follow a symlink nested inside a junction — `stat` fails with
  // ENOENT even though the target exists. Resolve to a concrete real path and
  // mirror that, so the cache only ever points at real files and directories and
  // never chains one reparse point onto another.
  const realPath = resolveLinkTarget(sourcePath, linkStats);
  if (!realPath) return;

  let realStats: Stats;
  try {
    realStats = statSync(realPath);
  } catch {
    // Genuinely dangling (missing store entry). Skip the child rather than abort
    // the whole mirror; the loader surfaces the missing dependency downstream.
    return;
  }

  if (realStats.isDirectory()) symlinkSync(realPath, targetPath, "junction");
  else copyFileSync(realPath, targetPath);
};

const resolveLinkTarget = (sourcePath: string, linkStats: Stats): string | null => {
  try {
    return realpathSync(sourcePath);
  } catch {
    if (!linkStats.isSymbolicLink()) return null;
    try {
      const target = readlinkSync(sourcePath);
      return isAbsolute(target) ? target : resolve(dirname(sourcePath), target);
    } catch {
      return null;
    }
  }
};

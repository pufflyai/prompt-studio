import { posix } from "node:path";
import type { RestoreRoot } from "./restore-plan";

type Link = "gitdir-file" | "path" | "alternates" | "config";
const linkBytes = 64 * 1024;

const linkKind = (root: RestoreRoot, path: string): Link | null => {
  const name = posix.basename(path);
  if (!root.prefix && name === ".git") return "gitdir-file";
  // Inside the folder only Git administration is rewritten; a dependency root is all administration.
  if (!root.prefix && !/(^|\/)\.git\//.test(path)) return null;
  if (name === "commondir" || name === "gitdir") return "path";
  if (path === "objects/info/alternates" || path === "info/alternates" || path.endsWith("/objects/info/alternates"))
    return "alternates";
  if (name === "config") return "config";
  return null;
};

/**
 * Git links name absolute paths on the source device. Each target that was restored, inside
 * the folder or as rebuilt external administration, is pointed at its restored location;
 * relative links stay relative. Other text is left as captured. Recovery never runs Git.
 */
export const createRecoveryGitLinks = (input: { destination: string; roots: RestoreRoot[] }) => {
  const table = input.roots
    .map((root) => ({
      from: root.source,
      to: root.prefix ? posix.join(input.destination, root.prefix) : input.destination,
    }))
    .sort((a, b) => b.from.length - a.from.length);
  const restored = (path: string) => {
    for (const { from, to } of table)
      if (path === from || path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
    return null;
  };
  const relink = (value: string, sourceBase: string, restoredBase: string) => {
    const target = restored(posix.isAbsolute(value) ? posix.normalize(value) : posix.resolve(sourceBase, value));
    if (!target) return value;
    return posix.isAbsolute(value) ? target : posix.relative(restoredBase, target) || ".";
  };
  return {
    /** Whether the entry's bytes must be read whole to rebuild its links. */
    candidate: (root: RestoreRoot, path: string, size: number) => size <= linkBytes && linkKind(root, path) !== null,
    /** The rebuilt text, or null when the captured bytes stay unchanged. */
    rewrite(root: RestoreRoot, path: string, bytes: Uint8Array) {
      const kind = linkKind(root, path);
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return null;
      }
      const directory = posix.dirname(path) === "." ? "" : posix.dirname(path);
      const sourceDirectory = posix.join(root.source, directory);
      const restoredDirectory = restored(sourceDirectory) ?? sourceDirectory;
      let next = text;
      if (kind === "gitdir-file")
        next = text.replace(
          /^(gitdir: )(.+?)(\s*)$/m,
          (_, head, value, tail) => `${head}${relink(value, sourceDirectory, restoredDirectory)}${tail}`,
        );
      else if (kind === "path")
        next = text.replace(
          /^(.+?)(\s*)$/s,
          (_, value, tail) => `${relink(value, sourceDirectory, restoredDirectory)}${tail}`,
        );
      else if (kind === "alternates") {
        // Relative alternates are relative to the object directory that owns info/alternates.
        const objects = posix.dirname(sourceDirectory);
        const restoredObjects = posix.dirname(restoredDirectory);
        next = text
          .split("\n")
          .map((line) =>
            !line.trim() || line.startsWith("#") || line.startsWith('"')
              ? line
              : relink(line, objects, restoredObjects),
          )
          .join("\n");
      } else if (kind === "config")
        next = text.replace(
          /^(\s*worktree\s*=\s*)([^"\s;#][^;#\n]*?)(\s*)$/gim,
          (_, head, value, tail) => `${head}${relink(value, sourceDirectory, restoredDirectory)}${tail}`,
        );
      return next === text ? null : new TextEncoder().encode(next);
    },
  };
};

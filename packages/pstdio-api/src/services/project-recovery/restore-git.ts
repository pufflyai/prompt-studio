import { posix } from "node:path";
import type { RestoreRoot } from "./restore-plan";

type Link = "gitdir-file" | "path" | "alternates" | "config";
export type RecoveryOmission = { path: string; reason: "git-link-outside-folder" | "git-setting-outside-folder" };
const linkBytes = 64 * 1024;
const configBytes = 1024 * 1024;

const linkKind = (root: RestoreRoot, path: string): Link | null => {
  const name = posix.basename(path);
  if (!root.prefix && name === ".git") return "gitdir-file";
  // Inside the folder only Git administration is rewritten, including administration an
  // earlier restore rebuilt; a dependency root is all administration.
  if (!root.prefix && !/(^|\/)\.git\//.test(path) && !path.startsWith(".pstdio/recovery/")) return null;
  if (name === "commondir" || name === "gitdir") return "path";
  if (path === "objects/info/alternates" || path === "info/alternates" || path.endsWith("/objects/info/alternates"))
    return "alternates";
  if (name === "config") return "config";
  return null;
};

/** Returns the restored link text, or null for a target outside the folder; with no value, marks one unchecked. */
type Replace = (value?: string, base?: { source: string; restored: string }) => string | null;
/** Each link kind's text with its paths replaced; `replace` returns null for a target outside the folder. */
const rebuild: Record<Link, (text: string, replace: Replace, source: string, restored: string) => string> = {
  "gitdir-file": (text, replace) =>
    text.replace(/^(gitdir: )(.+?)([ \t\r]*)$/m, (line, head: string, value: string, tail: string) => {
      const next = replace(value);
      return next === null ? line : `${head}${next}${tail}`;
    }),
  path: (text, replace) =>
    text.replace(/^(.+?)(\s*)$/s, (whole, value: string, tail: string) => {
      const next = replace(value);
      return next === null ? whole : `${next}${tail}`;
    }),
  // Relative alternates are relative to the object directory that owns info/alternates.
  alternates: (text, replace, source, restored) =>
    text
      .split("\n")
      .map((line) => {
        if (!line.trim() || line.startsWith("#")) return line;
        // A quoted path cannot be checked, so it counts as outside.
        const base = { source: posix.dirname(source), restored: posix.dirname(restored) };
        return (line.startsWith('"') ? replace() : replace(line, base)) ?? line;
      })
      .join("\n"),
  // A work tree outside the folder is dropped; the rest of the configuration stays.
  config: (text, replace) =>
    text.replace(
      /^([ \t]*worktree[ \t]*=[ \t]*)([^"\s;#][^;#\n]*?)([ \t\r]*)(\n|$)/gim,
      (_, head: string, value: string, tail: string, end: string) => {
        const next = replace(value);
        return next === null ? "" : `${head}${next}${tail}${end}`;
      },
    ),
};

/**
 * Git links name paths on the source device. Each target that was restored, inside the
 * folder or as rebuilt external administration, is pointed at its restored location;
 * relative links stay relative. A link whose target stays outside the restored folder is
 * left out, so the folder can never write to another repository on this device, such as
 * the source itself. Other text is left as captured. Recovery never runs Git.
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
  const inside = (path: string) => path === input.destination || path.startsWith(`${input.destination}/`);
  /** The restored link text, or null when its target is outside the restored folder. */
  const relink = (value: string, sourceBase: string, restoredBase: string) => {
    const absolute = posix.isAbsolute(value);
    const target = restored(absolute ? posix.normalize(value) : posix.resolve(sourceBase, value));
    if (target) return absolute ? target : posix.relative(restoredBase, target) || ".";
    return inside(posix.resolve(restoredBase, value)) ? value : null;
  };
  return {
    /** `read` entries are rebuilt from their whole bytes; `omit` entries are links too large to check. */
    classify(root: RestoreRoot, path: string, size: number) {
      const kind = linkKind(root, path);
      if (!kind) return "plain" as const;
      if (size <= (kind === "config" ? configBytes : linkBytes)) return "read" as const;
      return kind === "config" ? ("plain" as const) : ("omit" as const);
    },
    /** The bytes to restore, whether they changed, or the reason the entry is left out. */
    rewrite(root: RestoreRoot, path: string, bytes: Uint8Array) {
      const kind = linkKind(root, path);
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        if (kind === "config") return { bytes, changed: false };
        return { omit: "git-link-outside-folder" as const };
      }
      const directory = posix.dirname(path) === "." ? "" : posix.dirname(path);
      const sourceDirectory = posix.join(root.source, directory);
      const restoredDirectory = restored(sourceDirectory) ?? posix.join(input.destination, root.prefix, directory);
      let outside = false;
      const replace: Replace = (value, base = { source: sourceDirectory, restored: restoredDirectory }) => {
        const next = value === undefined ? null : relink(value, base.source, base.restored);
        if (next === null) outside = true;
        return next;
      };
      if (!kind) return { bytes, changed: false };
      const next = rebuild[kind](text, replace, sourceDirectory, restoredDirectory);
      if (kind === "config" && outside)
        return { bytes: new TextEncoder().encode(next), changed: true, omit: "git-setting-outside-folder" as const };
      if (outside) return { omit: "git-link-outside-folder" as const };
      return next === text ? { bytes, changed: false } : { bytes: new TextEncoder().encode(next), changed: true };
    },
  };
};

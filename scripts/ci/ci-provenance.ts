import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface CiProvenance {
  sha: string;
  tree: string;
  bun: string;
  node: string;
  platform: string;
  arch: string;
  inputsDigest: string;
}
export const currentCiProvenance = (root = process.cwd()) => {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const inputs = git(
    "ls-files",
    "scripts/ci",
    "scripts/build",
    ".github/workflows",
    "bun.lock",
    "package.json",
    "nx.json",
    "tsconfig.base.json",
  )
    .split("\n")
    .filter(Boolean)
    .sort();
  const hash = createHash("sha256");
  for (const file of inputs) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(resolve(root, file)));
    hash.update("\0");
  }
  for (const key of ["NODE_ENV", "PSTDIO_API_URL", "PSTDIO_TERMINAL_WEBSOCKET_URL"]) {
    hash.update(key);
    hash.update(process.env[key] ?? "");
    hash.update("\0");
  }
  return {
    sha: git("rev-parse", "HEAD"),
    tree: git("rev-parse", "HEAD^{tree}"),
    bun: Bun.version,
    node: execFileSync("node", ["--version"], { encoding: "utf8" }).trim(),
    platform: process.platform,
    arch: process.arch,
    inputsDigest: hash.digest("hex"),
  };
};

export const requireMatchingProvenance = (current: CiProvenance, candidate: CiProvenance) => {
  if (candidate.tree !== current.tree) throw new Error("Merged tree differs from tested candidate");
  if (
    candidate.bun !== current.bun ||
    candidate.node !== current.node ||
    candidate.platform !== current.platform ||
    candidate.arch !== current.arch ||
    candidate.inputsDigest !== current.inputsDigest
  )
    throw new Error("Merged build inputs differ from tested candidate");
};

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const reservedVersionFloor = (git: (...args: string[]) => string, tag: string) => {
  // A verification-only patch also reserves its version. Main must skip that
  // number even before the candidate ships.
  for (const candidate of git("tag", "--list", "pstdio@*").trim().split("\n")) {
    if (!/^pstdio@\d+\.\d+\.\d+$/.test(candidate)) continue;
    if (Bun.semver.order(candidate.slice(7), tag.slice(7)) > 0) {
      const message = git("show", "-s", "--format=%B", candidate);
      if (/^Patch-Base: pstdio@\d+\.\d+\.\d+$/m.test(message)) tag = candidate;
    }
  }
  return tag;
};

export const alignReleaseBaseline = async (root: string, tag: string) => {
  if (!/^pstdio@\d+\.\d+\.\d+$/.test(tag)) throw new Error(`Invalid stable release tag: ${tag}`);
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], { cwd: root });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim());
    return result.stdout.toString();
  };
  tag = reservedVersionFloor(git, tag);
  const releasedPaths = new Set(git("ls-tree", "-r", "--name-only", tag).trim().split("\n"));
  const config = JSON.parse(readFileSync(join(root, ".changeset/config.json"), "utf8")) as { fixed: string[][] };
  const fixed = new Set(config.fixed.flat());
  const { workspaces } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { workspaces: string[] };
  for (const workspace of workspaces) {
    for await (const path of new Bun.Glob(`${workspace.replace(/\/$/, "")}/package.json`).scan({
      cwd: root,
      dot: true,
    })) {
      const manifest = JSON.parse(readFileSync(join(root, path), "utf8")) as { name: string; version: string };
      // Glob returns native separators; Git tree paths always use forward slashes.
      const gitPath = path.replaceAll("\\", "/");
      if (!fixed.has(manifest.name) || !releasedPaths.has(gitPath)) continue;
      const released = JSON.parse(git("show", `${tag}:${gitPath}`)) as { name: string; version: string };
      if (released.name !== manifest.name || Bun.semver.order(manifest.version, released.version) >= 0) continue;
      // Only the version floor comes from the shipped release. Source, dependency
      // choices and pending changesets remain owned by main.
      manifest.version = released.version;
      writeFileSync(join(root, path), `${JSON.stringify(manifest, null, 2)}\n`);
    }
  }
};

if (import.meta.main && process.env.PSTDIO_STABLE_TAG) {
  await alignReleaseBaseline(process.cwd(), process.env.PSTDIO_STABLE_TAG);
}

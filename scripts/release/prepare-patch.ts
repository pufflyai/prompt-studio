import { readFileSync } from "node:fs";
import {
  planStableRelease,
  publishedPackages,
  readPatchBaseTag,
  readReleaseState,
  readTagCommit,
  writeOutputs,
} from "./plan-release";
import { patchVersion, validatePatchSource, versionPatch } from "./version-patch";

interface PatchCandidateInput {
  baseTag: string;
  currentStableTag: string;
  source: string;
  tagCommit: string | null;
  tagParent: string | null;
  releaseState: "missing" | "draft" | "published";
}

export const planPatchCandidate = (input: PatchCandidateInput) => {
  const version = patchVersion(input.baseTag, input.baseTag);
  if (input.releaseState === "published") return { release: false as const };
  patchVersion(input.baseTag, input.currentStableTag);
  const tag = `pstdio@${version}`;
  if (input.tagCommit && input.tagParent !== input.source)
    throw new Error(`${tag} is reserved by another release candidate. Finish that release before preparing a patch.`);
  return { release: true as const, version, tag, reuse: input.tagCommit !== null };
};

const run = (command: string[]) => {
  const result = Bun.spawnSync(command, { stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error(`${command.join(" ")} failed with ${result.exitCode}.`);
};

const capture = (command: string[]) => {
  const result = Bun.spawnSync(command);
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim());
  return result.stdout.toString().trim();
};

const versionFixCheckout = async (baseTag: string, source: string, summary: string, version: string) => {
  const descendsFromBase = Bun.spawnSync(["git", "merge-base", "--is-ancestor", baseTag, source]).exitCode === 0;
  const sourceVersion = (
    JSON.parse(capture(["git", "show", `${source}:packages/pstdio/package.json`])) as { version: string }
  ).version;
  validatePatchSource({ descendsFromBase, sourceVersion, baseTag });
  // Load release tooling from main, then version only the selected fix checkout.
  run(["git", "checkout", "--detach", source]);
  const config = JSON.parse(readFileSync(".changeset/config.json", "utf8")) as { fixed: string[][] };
  const fixed = new Set(config.fixed.flat());
  const root = JSON.parse(readFileSync("package.json", "utf8")) as { workspaces: string[] };
  for (const workspace of root.workspaces) {
    for await (const path of new Bun.Glob(`${workspace.replace(/\/$/, "")}/package.json`).scan({ dot: true })) {
      const manifest = JSON.parse(readFileSync(path, "utf8")) as { name: string; version: string };
      if (fixed.has(manifest.name)) validatePatchSource({ descendsFromBase, sourceVersion: manifest.version, baseTag });
    }
  }
  const actualVersion = await versionPatch(process.cwd(), summary);
  if (actualVersion !== version) throw new Error(`Expected patch ${version}, got ${actualVersion}.`);
  for (const script of ["release:stamp-dates", "release:platforms:sync"])
    run(["bun", "run", "--cwd", "scripts", script]);
  run(["bun", "install"]);
  for (const script of ["release:lockfile:sync", "verify:lockfile"]) run(["bun", "run", "--cwd", "scripts", script]);
  const publication = planStableRelease({
    releaseState: "missing",
    packages: await publishedPackages(),
    tagCommit: null,
    patchBaseTag: null,
    headCommit: source,
    mainCommit: source,
  });
  if (publication.release && publication.problems.length) throw new Error(publication.problems.join("\n"));
};

const preparePatch = async () => {
  const baseTag = process.env.PATCH_BASE_TAG ?? "";
  const source = process.env.PATCH_SOURCE_SHA ?? "";
  const summary = process.env.PATCH_SUMMARY ?? "";
  if (!/^[a-f0-9]{40}$/.test(source)) throw new Error("Supply the full 40-character fix commit SHA.");
  if (!summary.trim() || summary.includes("\n")) throw new Error("Supply a one-line patch summary.");
  const version = patchVersion(baseTag, baseTag);
  const tag = `pstdio@${version}`;
  const tagCommit = readTagCommit(tag);
  if (tagCommit) run(["git", "fetch", "origin", `refs/tags/${tag}:refs/tags/${tag}`]);
  const plan = planPatchCandidate({
    baseTag,
    source,
    currentStableTag: capture(["gh", "release", "view", "--json", "tagName", "--jq", ".tagName"]),
    tagCommit,
    tagParent: tagCommit ? capture(["git", "rev-parse", `${tagCommit}^`]) : null,
    releaseState: await readReleaseState(tag),
  });
  if (!plan.release) {
    writeOutputs({ release: "false" });
    return;
  }

  if (plan.reuse && tagCommit && readPatchBaseTag(tagCommit) !== baseTag)
    throw new Error(`${tag} belongs to another release candidate.`);

  if (!plan.reuse) {
    await versionFixCheckout(baseTag, source, summary, version);
    run(["git", "config", "user.name", "github-actions[bot]"]);
    run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
    run(["git", "add", "-A"]);
    run(["git", "commit", "-m", `chore: version patch ${tag}\n\nPatch-Base: ${baseTag}`]);
    run(["git", "tag", tag]);
    run(["git", "push", "origin", `refs/tags/${tag}`]);
  }
  writeOutputs({
    release: "true",
    version,
    tag,
    commit: tagCommit ?? capture(["git", "rev-parse", "HEAD"]),
    previous_tag: baseTag,
  });
};

if (import.meta.main) await preparePatch();

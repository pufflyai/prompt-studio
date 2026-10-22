import { appendFileSync } from "node:fs";
import { $ } from "bun";

interface PublishedPackage {
  name: string;
  version: string;
  // Null when the package has never been published.
  npmVersions: string[] | null;
}

type ReleaseState = "missing" | "draft" | "published";

interface StableReleaseInput {
  releaseState: ReleaseState;
  // Every package a release publishes: public workspace packages and the CLI platform packages.
  packages: PublishedPackage[];
  tagCommit: string | null;
  patchBaseTag: string | null;
  headCommit: string;
  mainCommit: string;
}

export const planStableRelease = ({
  releaseState,
  packages,
  tagCommit,
  patchBaseTag,
  headCommit,
  mainCommit,
}: StableReleaseInput) => {
  // The publish job publishes the GitHub release last, so only a published release proves that
  // npm and every desktop asset shipped. npm alone can hold a version whose desktop apps never did.
  if (releaseState === "published") return { release: false as const };

  // A verification-only patch must never be published by a later push to main.
  if (patchBaseTag) return { release: false as const };

  const problems: string[] = [];
  for (const pkg of packages)
    if (pkg.npmVersions === null)
      problems.push(
        `${pkg.name} is not on npm. Trusted publishing cannot create a package. Publish its first version by hand or make it private.`,
      );

  // Once npm has part of this version, the rest must ship from the commit that started publishing.
  const publishStarted = packages.some((pkg) => pkg.npmVersions?.includes(pkg.version));
  const version = packages.find((pkg) => pkg.name === "pstdio")?.version;
  if (publishStarted && !tagCommit)
    problems.push(
      `Packages of ${version} are on npm, but the tag pstdio@${version} does not exist, so the commit that started publishing is unknown.`,
    );

  // Before publishing starts, the newest commit on main owns the release. A re-run of an older
  // run must not move the tag back.
  if (!publishStarted && headCommit !== mainCommit) return { release: false as const };

  const commit = publishStarted && tagCommit ? tagCommit : headCommit;
  return { release: true as const, commit, placeTag: tagCommit !== commit, problems };
};

const npmVersions = async (name: string) => {
  const result = Bun.spawnSync(["npm", "view", name, "versions", "--json"]);
  if (result.exitCode !== 0) {
    if (result.stderr.toString().includes("E404")) return null;
    throw new Error(`npm view ${name} failed: ${result.stderr.toString().trim()}`);
  }
  const versions = JSON.parse(result.stdout.toString()) as string | string[];
  return Array.isArray(versions) ? versions : [versions];
};

// Public workspace packages and the CLI platform packages that pstdio pins exactly. The publish
// job publishes the platform packages first.
export const publishedPackages = async () => {
  const root = (await Bun.file("package.json").json()) as { workspaces: string[] };
  const manifests: Array<{ name: string; version: string }> = [];
  for (const workspace of root.workspaces) {
    for await (const path of new Bun.Glob(`${workspace.replace(/\/$/, "")}/package.json`).scan(".")) {
      const manifest = (await Bun.file(path).json()) as { name?: string; version?: string; private?: boolean };
      if (manifest.private || !manifest.name || !manifest.version) continue;
      manifests.push({ name: manifest.name, version: manifest.version });
    }
  }
  const pstdio = (await Bun.file("packages/pstdio/package.json").json()) as {
    optionalDependencies: Record<string, string>;
  };
  for (const [name, version] of Object.entries(pstdio.optionalDependencies))
    if (name.startsWith("@pstdio/cli-")) manifests.push({ name, version });
  return Promise.all(
    manifests.map(async (manifest) => ({ ...manifest, npmVersions: await npmVersions(manifest.name) })),
  );
};

// Lightweight tags list the commit. Annotated tags also list the peeled commit as `<tag>^{}`.
export const readTagCommit = (tag: string) => {
  const result = Bun.spawnSync(["git", "ls-remote", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`]);
  if (result.exitCode !== 0) throw new Error(`git ls-remote failed: ${result.stderr.toString().trim()}`);
  const refs = new Map(
    result.stdout
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => [line.split("\t")[1], line.split("\t")[0]]),
  );
  return refs.get(`refs/tags/${tag}^{}`) ?? refs.get(`refs/tags/${tag}`) ?? null;
};

export const readPatchBaseTag = (commit: string) => {
  const result = Bun.spawnSync(["git", "show", "-s", "--format=%B", commit]);
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim());
  return /^Patch-Base: (pstdio@\d+\.\d+\.\d+)$/m.exec(result.stdout.toString())?.[1] ?? null;
};

export const readReleaseState = async (tag: string): Promise<ReleaseState> => {
  const result = await $`gh release view ${tag} --json isDraft --jq .isDraft`.quiet().nothrow();
  if (result.exitCode === 0) return result.text().trim() === "true" ? "draft" : "published";
  if (result.stderr.toString().includes("release not found")) return "missing";
  throw new Error(`gh release view ${tag} failed: ${result.stderr.toString().trim()}`);
};

export const writeOutputs = (outputs: Record<string, string>) => {
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  console.log(lines.join("\n"));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
};

if (import.meta.main) {
  const { version } = (await Bun.file("packages/pstdio/package.json").json()) as { version: string };
  const tag = `pstdio@${version}`;
  const packages = await publishedPackages();
  const tagCommit = readTagCommit(tag);
  const plan = planStableRelease({
    releaseState: await readReleaseState(tag),
    packages,
    tagCommit,
    patchBaseTag: tagCommit ? readPatchBaseTag(tagCommit) : null,
    headCommit: (await $`git rev-parse HEAD`.text()).trim(),
    mainCommit: (await $`git ls-remote origin refs/heads/main`.text()).split("\t")[0] ?? "",
  });
  if (!plan.release) {
    console.log(`${tag} is released, or a newer commit on main releases it.`);
    writeOutputs({ release: "false" });
    process.exit(0);
  }
  for (const problem of plan.problems) console.error(`::error::${problem}`);
  if (plan.problems.length > 0) process.exit(1);
  // The Windows update check upgrades from the newest published release.
  const previousTag = (await $`gh release view --json tagName --jq .tagName`.text()).trim();
  writeOutputs({
    release: "true",
    version,
    tag,
    commit: plan.commit,
    place_tag: String(plan.placeTag),
    previous_tag: previousTag,
  });
}

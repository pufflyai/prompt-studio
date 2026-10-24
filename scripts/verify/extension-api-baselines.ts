import { spawnSync } from "node:child_process";

interface ApiBaseline {
  sdk: string;
  api: string;
}
export const selectApiBaselines = (declaration: string, releases: ApiBaseline[]) => {
  const baselines = declaration.split("||").flatMap((term) => {
    const supported = releases
      .filter((release) => Bun.semver.satisfies(release.api, term.trim()))
      .sort((a, b) => Bun.semver.order(a.sdk, b.sdk));
    // Nightly SDKs are published too; they are the baseline only until a stable release ships that API.
    const baseline = supported.find((release) => !release.sdk.includes("-")) ?? supported[0];
    return baseline ? [baseline] : [];
  });
  if (!baselines.length)
    throw new Error(
      `No released SDK supports extension API ${declaration}. Fetch release tags, or wait for a nightly or stable release of that API.`,
    );
  return baselines;
};

export const releasedApiBaselines = (root: string) => {
  const git = (args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  const tags = git(["tag", "--list", "pstdio@*"]);
  if (tags.status !== 0) throw new Error("Cannot read host release tags");
  // Some release tags never reached the registry, and only published SDKs can be installed.
  const versions = spawnSync("bun", ["pm", "view", "@pstdio/sdk", "versions"], { cwd: root, encoding: "utf8" });
  if (versions.status !== 0) throw new Error("Cannot read published @pstdio/sdk versions");
  const published = new Set<string>(JSON.parse(versions.stdout));
  const releases: ApiBaseline[] = [];
  for (const tag of tags.stdout.trim().split("\n")) {
    if (!/^pstdio@\d+\.\d+\.\d+(-nightly\.\d+)?$/.test(tag) || !published.has(tag.slice("pstdio@".length))) continue;
    const source = git(["show", `${tag}:packages/pstdio-api-contracts/src/extension-kernel/types/extension.ts`]);
    const api = /export const EXTENSION_API_VERSION = "(\d+\.\d+\.\d+)"/.exec(source.stdout)?.[1];
    if (api) releases.push({ sdk: tag.slice("pstdio@".length), api });
  }
  return releases;
};

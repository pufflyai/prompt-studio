import { spawnSync } from "node:child_process";

interface ApiBaseline {
  sdk: string;
  api: string;
}
export const selectApiBaselines = (declaration: string, releases: ApiBaseline[]) => {
  const baselines = declaration.split("||").flatMap((term) => {
    const baseline = releases
      .filter((release) => Bun.semver.satisfies(release.api, term.trim()))
      .sort((a, b) => Bun.semver.order(a.sdk, b.sdk))[0];
    return baseline ? [baseline] : [];
  });
  if (!baselines.length)
    throw new Error(
      `No released SDK supports extension API ${declaration}. Fetch release tags, or wait for that API to be released.`,
    );
  return baselines;
};

export const releasedApiBaselines = (root: string) => {
  const git = (args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  const tags = git(["tag", "--list", "pstdio@*"]);
  if (tags.status !== 0) throw new Error("Cannot read host release tags");
  const releases: ApiBaseline[] = [];
  for (const tag of tags.stdout.trim().split("\n")) {
    if (!/^pstdio@\d+\.\d+\.\d+$/.test(tag)) continue;
    const source = git(["show", `${tag}:packages/pstdio-api-contracts/src/extension-kernel/types/extension.ts`]);
    const api = /export const EXTENSION_API_VERSION = "(\d+\.\d+\.\d+)"/.exec(source.stdout)?.[1];
    if (api) releases.push({ sdk: tag.slice("pstdio@".length), api });
  }
  return releases;
};

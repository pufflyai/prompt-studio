import { spawnSync } from "node:child_process";
import { readSdkRegistryMetadata, sdkRegistryBaselines } from "./extension-api-registry";

export interface ApiBaseline {
  sdk: string;
  api: string;
}
export const selectApiBaselines = (declaration: string, releases: ApiBaseline[], sdkRange?: string) => {
  const baselines = declaration.split("||").flatMap((term) => {
    const supported = releases
      .filter((release) => Bun.semver.satisfies(release.api, term.trim()))
      .sort((a, b) => Bun.semver.order(a.sdk, b.sdk));
    // Previews establish a baseline only until a stable SDK ships the API.
    const baseline =
      supported.find((release) => !release.sdk.includes("-")) ??
      supported.find((release) => sdkRange && Bun.semver.satisfies(release.sdk, sdkRange)) ??
      supported[0];
    return baseline ? [baseline] : [];
  });
  if (!baselines.length)
    throw new Error(
      `No published SDK supports extension API ${declaration}. Publish an SDK preview or choose a supported API minimum.`,
    );
  return baselines;
};

export const releasedApiBaselines = async (root: string) => {
  const metadata = await readSdkRegistryMetadata();
  const releases = sdkRegistryBaselines(metadata);
  const known = new Set(releases.map((release) => release.sdk));
  const git = (args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  const tags = git(["tag", "--list", "pstdio@*"]);
  if (tags.status !== 0) throw new Error("Cannot read host release tags");
  // Older published SDKs have no manifest API metadata. Their release tags remain a historical source.
  const published = new Set(Object.keys(metadata.versions));
  for (const tag of tags.stdout.trim().split("\n")) {
    const sdk = tag.slice("pstdio@".length);
    if (!/^pstdio@\d+\.\d+\.\d+(-nightly\.\d+)?$/.test(tag) || !published.has(sdk) || known.has(sdk)) continue;
    const source = git(["show", `${tag}:packages/pstdio-api-contracts/src/extension-kernel/types/extension.ts`]);
    const api = /export const EXTENSION_API_VERSION = "(\d+\.\d+\.\d+)"/.exec(source.stdout)?.[1];
    if (api) {
      releases.push({ sdk, api });
      known.add(sdk);
    }
  }
  return releases;
};

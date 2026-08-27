import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

export type DesktopReleaseTarget = "darwin-arm64" | "darwin-x64" | "linux-x64" | "win32-x64";

type ReleaseAsset = {
  name: string;
  kind: "archive" | "installer" | "package" | "update-metadata";
  sha256: string;
  bytes: number;
};

export type DesktopReleaseManifest = {
  schemaVersion: 1;
  target: DesktopReleaseTarget;
  version: string;
  releaseTag: string;
  updateMode: "automatic" | "manual";
  componentVersions: {
    application: string;
    dashboard: string;
    installer: string;
    sidecar: string;
    updateMetadata: string;
  };
  assets: ReleaseAsset[];
};

type PrepareReleaseInput = {
  desktopRoot: string;
  runtimePackagePath: string;
  target: DesktopReleaseTarget;
  releaseNotes: string;
  publishedAt: string;
};

type SidecarManifest = {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
  executable: string;
  checksum: string;
};

const activeReleaseTargets: DesktopReleaseTarget[] = ["darwin-arm64", "darwin-x64", "linux-x64"];

export const parseDesktopReleaseTarget = (value: string) => {
  const target = activeReleaseTargets.find((candidate) => candidate === value);
  if (!target) throw new Error(`Unsupported desktop release target ${value}`);
  return target;
};

const readJson = <T>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;
const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

const walkFiles = (root: string): string[] =>
  readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });

const oneFile = (root: string, description: string, predicate: (path: string) => boolean) => {
  const matches = walkFiles(root).filter(predicate);
  if (matches.length !== 1) {
    throw new Error(`Expected one ${description}; found ${matches.length}`);
  }
  return matches[0]!;
};

const targetParts = (target: DesktopReleaseTarget) => {
  const separator = target.lastIndexOf("-");
  return {
    platform: target.slice(0, separator) as NodeJS.Platform,
    arch: target.slice(separator + 1),
  };
};

const verifyComponentVersions = (input: PrepareReleaseInput) => {
  const desktopVersion = readJson<{ version: string }>(join(input.desktopRoot, "package.json")).version;
  const runtimeVersion = readJson<{ version: string }>(input.runtimePackagePath).version;
  if (desktopVersion !== runtimeVersion) {
    throw new Error(`Desktop ${desktopVersion} does not match runtime ${runtimeVersion}`);
  }

  const { platform, arch } = targetParts(input.target);
  const sidecarRoot = join(input.desktopRoot, ".sidecar", "bin");
  const sidecar = readJson<SidecarManifest>(join(sidecarRoot, "pstdio.manifest.json"));
  if (sidecar.platform !== platform || sidecar.arch !== arch) {
    throw new Error(`Sidecar ${sidecar.platform}-${sidecar.arch} does not match release ${input.target}`);
  }
  if (sidecar.version !== desktopVersion) {
    throw new Error(`Sidecar ${sidecar.version} does not match desktop ${desktopVersion}`);
  }
  if (sha256(join(sidecarRoot, sidecar.executable)) !== sidecar.checksum) {
    throw new Error("Sidecar checksum does not match its release manifest");
  }
  return desktopVersion;
};

const copyAsset = (source: string, outputPath: string, name: string) => {
  const destination = join(outputPath, name);
  copyFileSync(source, destination);
  return destination;
};

const prepareMacAssets = (input: PrepareReleaseInput, outputPath: string, version: string) => {
  const makeRoot = join(input.desktopRoot, "out", "make");
  const dmgName = `Prompt-Studio-${version}-${input.target}.dmg`;
  const zipName = `Prompt-Studio-${version}-${input.target}.zip`;
  const metadataName = `RELEASES-${input.target}.json`;
  copyAsset(
    oneFile(makeRoot, "macOS DMG", (path) => path.endsWith(".dmg")),
    outputPath,
    dmgName,
  );
  copyAsset(
    oneFile(makeRoot, "macOS ZIP", (path) => path.endsWith(".zip") && path.includes(input.target)),
    outputPath,
    zipName,
  );
  writeJson(join(outputPath, metadataName), {
    version,
    name: `Prompt Studio ${version}`,
    notes: input.releaseNotes,
    pub_date: input.publishedAt,
    url: `https://github.com/pufflyai/prompt-studio/releases/download/pstdio@${version}/${zipName}`,
  });
  return new Map([
    [dmgName, "installer" as const],
    [zipName, "archive" as const],
    [metadataName, "update-metadata" as const],
  ]);
};

const prepareWindowsAssets = (input: PrepareReleaseInput, outputPath: string, version: string) => {
  const makeRoot = join(input.desktopRoot, "out", "make");
  const setup = oneFile(makeRoot, "Windows installer", (path) => path.endsWith(" Setup.exe"));
  const packagePath = oneFile(makeRoot, "Windows update package", (path) => path.endsWith("-full.nupkg"));
  const releases = oneFile(makeRoot, "Windows RELEASES metadata", (path) => basename(path) === "RELEASES");
  const packageName = basename(packagePath);
  const releasesContent = readFileSync(releases, "utf8");
  if (!basename(setup).includes(version) || !packageName.includes(version) || !releasesContent.includes(packageName)) {
    throw new Error(`Windows installer or update metadata does not match desktop ${version}`);
  }
  const setupName = `Prompt-Studio-${version}-win32-x64-Setup.exe`;
  copyAsset(setup, outputPath, setupName);
  copyAsset(packagePath, outputPath, packageName);
  copyAsset(releases, outputPath, "RELEASES");
  return new Map([
    [setupName, "installer" as const],
    [packageName, "package" as const],
    ["RELEASES", "update-metadata" as const],
  ]);
};

const prepareLinuxAssets = (input: PrepareReleaseInput, outputPath: string, version: string) => {
  const makeRoot = join(input.desktopRoot, "out", "make");
  const debName = `Prompt-Studio-${version}-linux-x64.deb`;
  const zipName = `Prompt-Studio-${version}-linux-x64.zip`;
  copyAsset(
    oneFile(makeRoot, "Linux deb", (path) => path.endsWith(".deb")),
    outputPath,
    debName,
  );
  copyAsset(
    oneFile(makeRoot, "Linux portable ZIP", (path) => path.endsWith(".zip") && path.includes("linux-x64")),
    outputPath,
    zipName,
  );
  return new Map([
    [debName, "installer" as const],
    [zipName, "archive" as const],
  ]);
};

const prepareTargetAssets = (input: PrepareReleaseInput, outputPath: string, version: string) => {
  if (input.target.startsWith("darwin-")) return prepareMacAssets(input, outputPath, version);
  if (input.target === "win32-x64") return prepareWindowsAssets(input, outputPath, version);
  return prepareLinuxAssets(input, outputPath, version);
};

export const prepareDesktopReleaseArtifacts = (input: PrepareReleaseInput) => {
  const version = verifyComponentVersions(input);
  const outputPath = join(input.desktopRoot, "out", "release", input.target);
  rmSync(outputPath, { recursive: true, force: true });
  mkdirSync(outputPath, { recursive: true });
  const assetKinds = prepareTargetAssets(input, outputPath, version);
  const assets = [...assetKinds.entries()]
    .map(([name, kind]) => {
      const path = join(outputPath, name);
      return { name, kind, sha256: sha256(path), bytes: statSync(path).size };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const manifest: DesktopReleaseManifest = {
    schemaVersion: 1,
    target: input.target,
    version,
    releaseTag: `pstdio@${version}`,
    updateMode: input.target === "linux-x64" ? "manual" : "automatic",
    componentVersions: {
      application: version,
      dashboard: version,
      installer: version,
      sidecar: version,
      updateMetadata: version,
    },
    assets,
  };
  const manifestPath = join(outputPath, `desktop-release-${input.target}.json`);
  writeJson(manifestPath, manifest);
  const checksumsPath = join(outputPath, `checksums-${input.target}.sha256`);
  writeFileSync(checksumsPath, `${assets.map((asset) => `${asset.sha256}  ${asset.name}`).join("\n")}\n`);
  return { outputPath, manifestPath, checksumsPath, manifest };
};

export const verifyDesktopReleaseSet = (root: string) => {
  const manifests = new Map(
    walkFiles(root)
      .filter((path) => basename(path).startsWith("desktop-release-") && path.endsWith(".json"))
      .map((path) => {
        const manifest = readJson<DesktopReleaseManifest>(path);
        return [manifest.target, manifest] as const;
      }),
  );
  for (const target of activeReleaseTargets) {
    if (!manifests.has(target)) throw new Error(`Missing desktop release target ${target}`);
  }
  const [first] = manifests.values();
  if (!first) throw new Error("Desktop release set is empty");
  for (const manifest of manifests.values()) {
    if (manifest.version !== first.version || manifest.releaseTag !== first.releaseTag) {
      throw new Error(`Desktop release target ${manifest.target} has version drift`);
    }
    if (Object.values(manifest.componentVersions).some((version) => version !== first.version)) {
      throw new Error(`Desktop release target ${manifest.target} has component version drift`);
    }
  }
  return { version: first.version, releaseTag: first.releaseTag };
};

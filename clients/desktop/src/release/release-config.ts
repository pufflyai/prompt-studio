import { rcompare, valid } from "semver";

const RELEASE_REPOSITORY = "pufflyai/prompt-studio";
const RELEASES_URL = `https://github.com/${RELEASE_REPOSITORY}/releases`;
const RELEASES_API_URL = `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases?per_page=100`;
const RELEASE_DOWNLOAD_URL = `${RELEASES_URL}/download`;

export class DesktopReleaseConfigError extends Error {
  readonly code = "missing_release_credentials";

  constructor(names: string[]) {
    super(`Desktop release credentials are incomplete: ${names.join(", ")}`);
    this.name = "DesktopReleaseConfigError";
  }
}

type ReleaseEnvironment = Record<string, string | undefined>;

type GitHubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: Array<{ name: string }>;
};

type UpdateFeedInput = {
  platform: NodeJS.Platform;
  arch: string;
  fetchReleases?: () => Promise<GitHubRelease[]>;
};

type SigningInput = {
  platform: NodeJS.Platform;
  release: boolean;
  env: ReleaseEnvironment;
};

export type DesktopSigningConfig = {
  osxSign?: { identity: string };
  osxNotarize?: { appleApiKey: string; appleApiKeyId: string; appleApiIssuer: string };
  windowsSign?: { certificateFile: string; certificatePassword: string };
  squirrelWindowsSign?: { certificateFile: string; certificatePassword: string };
};

const requireValues = (env: ReleaseEnvironment, names: string[]) => {
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) throw new DesktopReleaseConfigError(missing);
  return Object.fromEntries(names.map((name) => [name, env[name]!]));
};

export const resolveDesktopSigning = (input: SigningInput): DesktopSigningConfig => {
  if (!input.release) return {};

  if (input.platform === "darwin") {
    const values = requireValues(input.env, [
      "MACOS_SIGN_IDENTITY",
      "APPLE_API_KEY",
      "APPLE_API_KEY_ID",
      "APPLE_API_ISSUER",
    ]);
    return {
      osxSign: {
        identity: values.MACOS_SIGN_IDENTITY,
      },
      osxNotarize: {
        appleApiKey: values.APPLE_API_KEY,
        appleApiKeyId: values.APPLE_API_KEY_ID,
        appleApiIssuer: values.APPLE_API_ISSUER,
      },
    };
  }

  if (input.platform === "win32") {
    const values = requireValues(input.env, ["WINDOWS_CERTIFICATE_FILE", "WINDOWS_CERTIFICATE_PASSWORD"]);
    const windowsSign = {
      certificateFile: values.WINDOWS_CERTIFICATE_FILE,
      certificatePassword: values.WINDOWS_CERTIFICATE_PASSWORD,
    };
    return { windowsSign, squirrelWindowsSign: windowsSign };
  }

  return {};
};

export const resolveDesktopUpdateStrategy = (platform: NodeJS.Platform) => {
  if (platform === "darwin" || platform === "win32") return { kind: "automatic" as const };
  return { kind: "manual" as const, releasesUrl: RELEASES_URL };
};

const fetchPublishedReleases = async () => {
  const response = await fetch(RELEASES_API_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub release lookup failed with status ${response.status}`);
  return (await response.json()) as GitHubRelease[];
};

const releaseVersion = (release: GitHubRelease) => {
  if (!release.tag_name.startsWith("pstdio@")) return null;
  const version = release.tag_name.slice("pstdio@".length);
  return valid(version) ? version : null;
};

const hasUpdateAssets = (release: GitHubRelease, platform: NodeJS.Platform, arch: string) => {
  const names = new Set(release.assets.map((asset) => asset.name));
  if (platform === "darwin") {
    const target = `darwin-${arch}`;
    return (
      names.has(`RELEASES-${target}.json`) && [...names].some((name) => name.includes(target) && name.endsWith(".zip"))
    );
  }
  return names.has("RELEASES") && [...names].some((name) => name.endsWith("-full.nupkg"));
};

export const resolveDesktopUpdateFeed = async (input: UpdateFeedInput) => {
  const releases = await (input.fetchReleases ?? fetchPublishedReleases)();
  const release = releases
    .filter((candidate) => !candidate.draft && !candidate.prerelease)
    .map((candidate) => ({ release: candidate, version: releaseVersion(candidate) }))
    .filter(
      (candidate): candidate is { release: GitHubRelease; version: string } =>
        candidate.version !== null && hasUpdateAssets(candidate.release, input.platform, input.arch),
    )
    .sort((left, right) => rcompare(left.version, right.version))[0]?.release;

  if (!release) {
    throw new Error(`No complete ${input.platform}-${input.arch} desktop update release is published`);
  }

  const releaseRoot = `${RELEASE_DOWNLOAD_URL}/${release.tag_name}`;
  return input.platform === "darwin" ? `${releaseRoot}/RELEASES-darwin-${input.arch}.json` : releaseRoot;
};

export const desktopReleasesUrl = RELEASES_URL;

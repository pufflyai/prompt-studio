export const DESKTOP_RELEASES_URL = "https://github.com/pufflyai/prompt-studio/releases";
const RELEASES_API = "https://api.github.com/repos/pufflyai/prompt-studio/releases?per_page=100";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

export interface DesktopDownload {
  id: string;
  platform: string;
  architecture: string;
  format: string;
  url: string;
  size: number;
}

export interface DesktopRelease {
  version: string;
  downloads: DesktopDownload[];
}

const PLATFORMS = [
  { target: "darwin-arm64", platform: "macOS", architecture: "Apple silicon", formats: ["dmg"] },
  { target: "darwin-x64", platform: "macOS", architecture: "Intel", formats: ["dmg"] },
  { target: "linux-x64", platform: "Linux", architecture: "x64", formats: ["deb", "rpm", "AppImage", "zip"] },
  { target: "linux-arm64", platform: "Linux", architecture: "ARM64", formats: ["deb", "rpm", "AppImage", "zip"] },
  { target: "win32-x64", platform: "Windows", architecture: "x64", formats: ["exe"] },
  { target: "win32-arm64", platform: "Windows", architecture: "ARM64", formats: ["exe"] },
];

const versionParts = (tag: string) => /^pstdio@(\d+)\.(\d+)\.(\d+)$/.exec(tag)?.slice(1).map(Number);

const compareVersions = (left: GitHubRelease, right: GitHubRelease) => {
  const a = versionParts(left.tag_name)!;
  const b = versionParts(right.tag_name)!;
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return b[index] - a[index];
  }
  return 0;
};

export const desktopDownloads = (release: GitHubRelease) => {
  const version = release.tag_name.slice("pstdio@".length);
  return PLATFORMS.flatMap(({ target, platform, architecture, formats }) =>
    formats.flatMap((format) => {
      const asset = release.assets.find(
        (candidate) => candidate.name === `Prompt-Studio-${version}-${target}.${format}`,
      );
      if (!asset) return [];
      return [
        {
          id: `${target}-${format}`,
          platform,
          architecture,
          format,
          url: asset.browser_download_url,
          size: asset.size,
        },
      ];
    }),
  );
};

export const latestDesktopRelease = (releases: GitHubRelease[]) => {
  for (const release of releases
    .filter((candidate) => !candidate.draft && !candidate.prerelease && versionParts(candidate.tag_name))
    .sort(compareVersions)) {
    const downloads = desktopDownloads(release);
    if (downloads.length) return { version: release.tag_name.slice("pstdio@".length), downloads };
  }
  return undefined;
};

export const fetchDesktopRelease = async (signal: AbortSignal) => {
  let url: string | undefined = RELEASES_API;
  while (url) {
    const response: Response = await fetch(url, { signal, headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error("Desktop downloads could not be loaded.");
    const release = latestDesktopRelease((await response.json()) as GitHubRelease[]);
    if (release) return release;
    url = response.headers.get("Link")?.match(/<([^>]+)>; rel="next"/)?.[1];
  }
  throw new Error("No desktop release is available.");
};

export const preferredDownload = (downloads: DesktopDownload[], userAgent: string) => {
  if (/Linux/.test(userAgent) && !/Android/.test(userAgent)) {
    const architecture = /aarch64|arm64/i.test(userAgent) ? "ARM64" : "x64";
    return (
      downloads.find((download) => download.platform === "Linux" && download.architecture === architecture) ??
      downloads[0]
    );
  }
  if (/Windows/.test(userAgent)) return downloads.find((download) => download.platform === "Windows") ?? downloads[0];
  return downloads[0];
};

export const downloadDescription = (download: DesktopDownload) => {
  if (download.format === "deb") return "Debian / Ubuntu · DEB";
  if (download.format === "rpm") return "Fedora / openSUSE · RPM";
  if (download.format === "zip") return "ZIP archive";
  return download.format.toUpperCase();
};

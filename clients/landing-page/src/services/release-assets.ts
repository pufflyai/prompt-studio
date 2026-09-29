interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface GitHubRelease {
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

// File suffixes match the names the desktop release workflow uploads.
const PLATFORMS = [
  { target: "darwin-arm64", platform: "macOS", architecture: "Apple silicon", suffixes: [".dmg"] },
  { target: "darwin-x64", platform: "macOS", architecture: "Intel", suffixes: [".dmg"] },
  { target: "linux-x64", platform: "Linux", architecture: "x64", suffixes: [".deb", ".zip"] },
  { target: "win32-x64", platform: "Windows", architecture: "x64", suffixes: ["-Setup.exe"] },
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
  return PLATFORMS.flatMap(({ target, platform, architecture, suffixes }) =>
    suffixes.flatMap((suffix) => {
      const asset = release.assets.find(
        (candidate) => candidate.name === `Prompt-Studio-${version}-${target}${suffix}`,
      );
      if (!asset) return [];
      const format = suffix.slice(suffix.lastIndexOf(".") + 1);
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

export const preferredDownload = (downloads: DesktopDownload[], userAgent: string, maxTouchPoints: number) => {
  const mac = /Macintosh|Mac OS X/i.test(userAgent);
  // iPadOS can identify itself as a Mac when requesting desktop websites.
  if (/Android|iPhone|iPad|iPod|Windows Phone|CrOS/i.test(userAgent) || (mac && maxTouchPoints > 1)) {
    return undefined;
  }
  if (mac) return downloads.find((download) => download.platform === "macOS");
  const architecture = /aarch64|arm64/i.test(userAgent) ? "ARM64" : "x64";
  if (/Windows/i.test(userAgent)) {
    return downloads.find((download) => download.platform === "Windows" && download.architecture === architecture);
  }
  if (/Linux/i.test(userAgent)) {
    return downloads.find((download) => download.platform === "Linux" && download.architecture === architecture);
  }
  return undefined;
};

export const downloadDescription = (download: DesktopDownload) => {
  if (download.format === "deb") return "Debian / Ubuntu · DEB";
  if (download.format === "zip") return "ZIP archive";
  return download.format.toUpperCase();
};

import { type GitHubRelease, latestDesktopRelease } from "./release-assets";

export const DESKTOP_RELEASES_URL = "https://github.com/pufflyai/prompt-studio/releases";
const RELEASES_API = "https://api.github.com/repos/pufflyai/prompt-studio/releases?per_page=100";

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

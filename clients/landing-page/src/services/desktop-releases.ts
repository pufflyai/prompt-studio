import { type DesktopRelease, type GitHubRelease, latestDesktopRelease } from "./release-assets";

export const DESKTOP_RELEASES_URL = "https://github.com/pufflyai/prompt-studio/releases";
const RELEASES_API = "https://api.github.com/repos/pufflyai/prompt-studio/releases?per_page=100";
const CACHE_KEY = "desktop-release";
// GitHub allows 60 unauthenticated API requests per hour for each IP address.
const CACHE_TTL_MS = 10 * 60 * 1000;

interface FetchOptions {
  signal?: AbortSignal;
  /** Sent as a bearer token, so a build can use its own API allowance. */
  token?: string;
  url?: string;
}

export const fetchDesktopRelease = async ({ signal, token, url = RELEASES_API }: FetchOptions = {}) => {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let next: string | undefined = url;
  while (next) {
    const response: Response = await fetch(next, { signal, headers });
    if (!response.ok) throw new Error(`GitHub releases request failed with ${response.status}.`);
    const releases: unknown = await response.json();
    if (!Array.isArray(releases)) throw new Error("GitHub releases response is not a list.");
    const release = latestDesktopRelease(releases as GitHubRelease[]);
    if (release) return release;
    next = response.headers.get("Link")?.match(/<([^>]+)>; rel="next"/)?.[1];
  }
  throw new Error("No desktop release is available.");
};

const readCachedRelease = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (Date.now() - cached?.savedAt < CACHE_TTL_MS && Array.isArray(cached.release?.downloads)) {
      return cached.release as DesktopRelease;
    }
  } catch {
    // Storage can be missing or blocked; the release is fetched instead.
  }
  return undefined;
};

const cacheRelease = (release: DesktopRelease) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), release }));
  } catch {
    // Storage can be full or blocked; the next visit fetches again.
  }
};

interface LoadOptions extends Pick<FetchOptions, "signal" | "url"> {
  /** The release the site was built with. It is shown when the refresh fails. */
  snapshot?: DesktopRelease;
}

/** Loads the latest desktop release from the short-lived cache or GitHub, falling back to the build snapshot. */
export const loadDesktopRelease = async ({ snapshot, signal, url }: LoadOptions) => {
  const cached = readCachedRelease();
  if (cached) return cached;
  try {
    const release = await fetchDesktopRelease({ signal, url });
    cacheRelease(release);
    return release;
  } catch (error) {
    if (snapshot && !signal?.aborted) return snapshot;
    throw error;
  }
};

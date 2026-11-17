import { preparePublishedHost } from "./published-host-binary";

const releasesUrl = "https://api.github.com/repos/pufflyai/prompt-studio/releases?per_page=30";

// CI passes a token so the anonymous API rate limit cannot fail the test.
const githubHeaders = (): Record<string, string> => {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
};

/** The newest nightly users can install, with its binary for this platform. */
export const preparePublishedNightlyHost = async () => {
  const response = await fetch(releasesUrl, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`Cannot list releases: HTTP ${response.status}`);
  const releases = (await response.json()) as { tag_name: string; prerelease: boolean; draft: boolean }[];
  const nightly = releases.find(
    (release) => release.prerelease && !release.draft && /^pstdio@.+-nightly\./.test(release.tag_name),
  );
  if (!nightly) throw new Error("No published nightly release");

  return preparePublishedHost(nightly.tag_name);
};

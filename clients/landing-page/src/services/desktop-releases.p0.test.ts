import { afterEach, expect, test } from "bun:test";
import { fetchDesktopRelease, loadDesktopRelease } from "./desktop-releases";
import type { DesktopRelease, GitHubRelease } from "./release-assets";

const githubRelease = (version: string, prerelease = false): GitHubRelease => ({
  tag_name: `pstdio@${version}`,
  draft: false,
  prerelease,
  assets: [`Prompt-Studio-${version}-darwin-arm64.dmg`].map((name) => ({
    name,
    browser_download_url: `https://example.test/${name}`,
    size: 1,
  })),
});

const snapshot: DesktopRelease = {
  version: "0.40.0",
  downloads: [
    {
      id: "darwin-arm64-dmg",
      platform: "macOS",
      architecture: "Apple silicon",
      format: "dmg",
      url: "https://example.test/Prompt-Studio-0.40.0-darwin-arm64.dmg",
      size: 1,
    },
  ],
};

let server: ReturnType<typeof Bun.serve> | undefined;
afterEach(() => server?.stop(true));

/** Serves GitHub-like release pages; `pages[n]` answers `?page=n`. */
const serveReleases = (pages: Array<() => Response>) => {
  server = Bun.serve({
    port: 0,
    fetch: (request) => pages[Number(new URL(request.url).searchParams.get("page") ?? 0)]!(),
  });
  return `http://localhost:${server.port}/releases`;
};

test("follows pagination until a page has a stable desktop release", async () => {
  const url = serveReleases([
    () =>
      Response.json([githubRelease("0.48.0-nightly.20261120000000", true)], {
        headers: { Link: `<http://localhost:${server!.port}/releases?page=1>; rel="next"` },
      }),
    () => Response.json([githubRelease("0.47.0")]),
  ]);

  expect((await fetchDesktopRelease({ url })).version).toBe("0.47.0");
});

test("treats a rate-limited response as a failure", async () => {
  const url = serveReleases([() => Response.json({ message: "API rate limit exceeded" }, { status: 403 })]);

  await expect(fetchDesktopRelease({ url })).rejects.toThrow("403");
});

test("treats a successful response without a release list as a failure", async () => {
  const url = serveReleases([() => Response.json({ message: "Moved" })]);

  await expect(fetchDesktopRelease({ url })).rejects.toThrow("not a list");
});

test("keeps the build snapshot when GitHub refuses the refresh", async () => {
  const url = serveReleases([() => Response.json({ message: "API rate limit exceeded" }, { status: 403 })]);

  expect(await loadDesktopRelease({ snapshot, url })).toEqual(snapshot);
  await expect(loadDesktopRelease({ url })).rejects.toThrow("403");
});

test("prefers a fresh release over the build snapshot", async () => {
  const url = serveReleases([() => Response.json([githubRelease("0.47.0")])]);

  expect((await loadDesktopRelease({ snapshot, url })).version).toBe("0.47.0");
});

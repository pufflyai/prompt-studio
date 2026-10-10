import { expect, test } from "bun:test";
import { initializeReleaseReadiness } from "./release-readiness-gate";

interface FixtureOptions {
  branch: string;
  releaseHead: string | null;
  state?: string;
  refStatus?: number;
}

const withGitHub = async (
  fixture: FixtureOptions,
  check: (api: {
    apiUrl: string;
    published: Array<{ sha: string; state: string }>;
    requests: string[];
  }) => Promise<void>,
) => {
  const published: Array<{ sha: string; state: string }> = [];
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const path = new URL(request.url).pathname.replace("/repos/owner/repo/", "");
      requests.push(path);
      if (path === "pulls/1") return Response.json({ state: "open", head: { sha: "head", ref: fixture.branch } });
      if (path === "git/ref/heads/changeset-release/main") {
        if (fixture.refStatus) return new Response("GitHub unavailable", { status: fixture.refStatus });
        return fixture.releaseHead
          ? Response.json({ object: { sha: fixture.releaseHead } })
          : new Response("Missing", { status: 404 });
      }
      if (path === "commits/head/statuses")
        return Response.json(
          fixture.state
            ? [
                {
                  context: "release-readiness",
                  state: fixture.state,
                  description: "Rehearsal result",
                  creator: { login: "github-actions[bot]" },
                  target_url: "https://github.com/owner/repo/actions/runs/123",
                },
              ]
            : [],
        );
      if (path === "statuses/head" && request.method === "POST") {
        const body = await request.json();
        published.push({ sha: "head", state: body.state });
        return Response.json(body);
      }
      return new Response("Unexpected endpoint", { status: 404 });
    },
  });
  try {
    await check({ apiUrl: server.url.origin, published, requests });
  } finally {
    await server.stop(true);
  }
};

const options = (apiUrl: string) => ({
  apiUrl,
  repository: "owner/repo",
  token: "fixture",
  pullNumber: 1,
  runUrl: "https://github.com/owner/repo/actions/runs/456",
});

test.each([
  null,
  "another-head",
])("ordinary PRs pass without a rehearsal when release head is %s", async (releaseHead) => {
  await withGitHub({ branch: "feature/new-tool", releaseHead }, async ({ apiUrl, published, requests }) => {
    await initializeReleaseReadiness(options(apiUrl));
    expect(published).toEqual([{ sha: "head", state: "success" }]);
    expect(requests).toEqual(["pulls/1", "git/ref/heads/changeset-release/main", "statuses/head"]);
  });
});

test.each([
  undefined,
  "pending",
  "failure",
  "success",
  "error",
])("the rehearsal exclusively owns the version PR's status: %s", async (state) => {
  await withGitHub({ branch: "changeset-release/main", releaseHead: "head", state }, async ({ apiUrl, published }) => {
    await initializeReleaseReadiness(options(apiUrl));
    expect(published).toEqual([]);
  });
});

test.each([
  undefined,
  "pending",
  "failure",
  "success",
])("an ordinary PR sharing the release candidate cannot approve or reset its status: %s", async (state) => {
  await withGitHub({ branch: "feature/candidate-copy", releaseHead: "head", state }, async ({ apiUrl, published }) => {
    await initializeReleaseReadiness(options(apiUrl));
    expect(published).toEqual([]);
  });
});

test("a GitHub lookup failure cannot turn a release candidate into an ordinary passing commit", async () => {
  await withGitHub(
    { branch: "feature/new-tool", releaseHead: "head", refStatus: 500 },
    async ({ apiUrl, published }) => {
      await expect(initializeReleaseReadiness(options(apiUrl))).rejects.toThrow("GitHub 500");
      expect(published).toEqual([]);
    },
  );
});

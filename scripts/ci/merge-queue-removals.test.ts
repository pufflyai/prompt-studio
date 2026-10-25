import { expect, test } from "bun:test";
import { type PullQueueState, type QueueApi, REMOVED_LABEL, reconcilePull } from "./merge-queue-removals";

const fixture = (pulls: PullQueueState[]) => {
  const state = new Map(pulls.map((pull) => [pull.number, structuredClone(pull)]));
  const comments: Array<{ number: number; body: string }> = [];
  const api: QueueApi = {
    readPull: async (number) => structuredClone(state.get(number)!),
    readFailedRun: async (number) =>
      number === 1363
        ? {
            url: "https://github.com/owner/repo/actions/runs/7",
            jobs: ["windows_test_and_build (unit-1)", "build_clients (win32-x64)"],
          }
        : null,
    addLabel: async (number) => void state.get(number)!.labels.push(REMOVED_LABEL),
    removeLabel: async (number) => {
      const pull = state.get(number)!;
      pull.labels = pull.labels.filter((label) => label !== REMOVED_LABEL);
    },
    comment: async (number, body) => void comments.push({ number, body }),
  };
  return { api, state, comments };
};

const added = (at: string) => ({ kind: "added" as const, at });
const removed = (at: string, reason: string) => ({ kind: "removed" as const, at, reason });

test("a pull request removed for failed checks gets the label and one comment with the failed run", async () => {
  const { api, state, comments } = fixture([
    {
      number: 1363,
      state: "OPEN",
      labels: [],
      events: [added("2026-10-23T22:12:00Z"), removed("2026-10-23T22:57:00Z", "failed_checks")],
    },
  ]);

  await reconcilePull(api, 1363);
  await reconcilePull(api, 1363);

  expect(state.get(1363)!.labels).toEqual([REMOVED_LABEL]);
  expect(comments).toHaveLength(1);
  expect(comments[0]!.body).toContain("https://github.com/owner/repo/actions/runs/7");
  expect(comments[0]!.body).toContain("windows_test_and_build (unit-1)");
});

test("queueing again, merging or closing removes the label", async () => {
  const { api, state, comments } = fixture([
    {
      number: 1,
      state: "OPEN",
      labels: [REMOVED_LABEL],
      events: [removed("2026-10-23T06:37:00Z", "merge_conflict"), added("2026-10-23T07:03:00Z")],
    },
    { number: 2, state: "MERGED", labels: [REMOVED_LABEL], events: [removed("2026-10-23T09:38:00Z", "merged")] },
    { number: 3, state: "CLOSED", labels: [REMOVED_LABEL], events: [removed("2026-10-23T08:26:00Z", "failed_checks")] },
  ]);

  for (const number of [1, 2, 3]) await reconcilePull(api, number);

  expect([1, 2, 3].map((number) => state.get(number)!.labels)).toEqual([[], [], []]);
  expect(comments).toEqual([]);
});

test("a later removal after a new queue attempt is reported again", async () => {
  const { api, comments } = fixture([
    {
      number: 1367,
      state: "OPEN",
      labels: [],
      events: [
        added("2026-10-23T06:18:00Z"),
        removed("2026-10-23T06:37:00Z", "merge_conflict"),
        added("2026-10-23T08:18:00Z"),
        removed("2026-10-23T08:26:00Z", "failed_checks"),
      ],
    },
  ]);

  await reconcilePull(api, 1367);

  expect(comments).toHaveLength(1);
  expect(comments[0]!.body).toContain("a required check failed");
});

test("a manual removal is reported without blaming an earlier failed run", async () => {
  const { api, comments } = fixture([
    {
      number: 1363,
      state: "OPEN",
      labels: [],
      events: [
        removed("2026-10-23T22:57:00Z", "failed_checks"),
        added("2026-10-23T23:00:00Z"),
        removed("2026-10-23T23:16:00Z", "manual"),
      ],
    },
  ]);

  await reconcilePull(api, 1363);

  expect(comments[0]!.body).toContain("someone removed it");
  expect(comments[0]!.body).not.toContain("actions/runs");
});

test("a failed comment can be recovered without losing the removal explanation", async () => {
  const { api, state, comments } = fixture([
    {
      number: 1363,
      state: "OPEN",
      labels: [],
      events: [removed("2026-10-23T22:57:00Z", "failed_checks")],
    },
  ]);
  const comment = api.comment;
  api.comment = async () => {
    throw new Error("GitHub temporarily unavailable");
  };

  await expect(reconcilePull(api, 1363)).rejects.toThrow("GitHub temporarily unavailable");
  expect(state.get(1363)!.labels).toEqual([]);
  expect(comments).toEqual([]);

  api.comment = comment;
  await reconcilePull(api, 1363);
  await reconcilePull(api, 1363);

  expect(state.get(1363)!.labels).toEqual([REMOVED_LABEL]);
  expect(comments).toHaveLength(1);
});

test("a failed run lookup still reports the removal before starting a repair", async () => {
  const { api, state, comments } = fixture([
    {
      number: 1363,
      state: "OPEN",
      labels: [],
      events: [removed("2026-10-23T22:57:00Z", "failed_checks")],
    },
  ]);
  api.readFailedRun = async () => {
    throw new Error("GitHub temporarily unavailable");
  };

  await reconcilePull(api, 1363);

  expect(comments).toHaveLength(1);
  expect(comments[0]!.body).toContain("a required check failed");
  expect(state.get(1363)!.labels).toEqual([REMOVED_LABEL]);
});

test("queue removal reports retain the real failure after remaining jobs were cancelled", async () => {
  const { createApi } = await import("./merge-queue-removals");
  const runs = [
    {
      id: 3,
      conclusion: "cancelled" as string | null,
      status: "completed",
      created_at: "2026-10-24T08:02:00Z",
      head_branch: "gh-readonly-queue/main/pr-1394-a",
      html_url: "https://github.com/owner/repo/actions/runs/3",
    },
    {
      id: 2,
      conclusion: "cancelled" as string | null,
      status: "completed",
      created_at: "2026-10-24T08:01:00Z",
      head_branch: "gh-readonly-queue/main/pr-1394-a",
      html_url: "https://github.com/owner/repo/actions/runs/2",
    },
    {
      id: 1,
      conclusion: "failure",
      status: "completed",
      created_at: "2026-10-24T08:00:00Z",
      head_branch: "gh-readonly-queue/main/pr-1394-a",
      html_url: "https://github.com/owner/repo/actions/runs/1",
    },
  ];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/runs")) {
        return Response.json({
          workflow_runs: runs.filter(
            (run) =>
              !url.searchParams.has("status") ||
              (url.searchParams.get("status") === "completed"
                ? run.status === "completed"
                : run.conclusion === url.searchParams.get("status")),
          ),
        });
      }
      if (url.pathname.includes("/runs/3/"))
        return Response.json({ jobs: [{ name: "manually stopped", conclusion: "cancelled" }] });
      if (url.pathname.includes("/runs/1/"))
        return Response.json({ jobs: [{ name: "older failure", conclusion: "failure" }] });
      const jobs = [
        ...Array.from({ length: 100 }, (_, index) => ({ name: `passed ${index}`, conclusion: "success" })),
        { name: "Bun setup", conclusion: "failure" },
        { name: "e2e", conclusion: "cancelled" },
      ];
      const page = Number(url.searchParams.get("page") ?? 1);
      return Response.json({ jobs: jobs.slice((page - 1) * 100, page * 100) });
    },
  });
  try {
    const api = createApi({
      apiUrl: server.url.origin,
      graphqlUrl: server.url.origin,
      repository: "owner/repo",
      token: "fixture-token",
    });
    expect(await api.readFailedRun(1394, "2026-10-24T08:03:00Z")).toEqual({
      url: runs[1]!.html_url,
      jobs: ["Bun setup"],
    });
    runs[1]!.conclusion = null;
    runs[1]!.status = "in_progress";
    expect(await api.readFailedRun(1394, "2026-10-24T08:03:00Z")).toEqual({
      url: runs[1]!.html_url,
      jobs: ["Bun setup"],
    });
    runs.splice(1);
    expect(await api.readFailedRun(1394, "2026-10-24T08:03:00Z")).toBeNull();
  } finally {
    await server.stop(true);
  }
});

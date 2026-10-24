import { expect, test } from "bun:test";
import { monitorMergeQueue } from "./merge-queue-fail-fast";

type Job = { name: string; status: string; conclusion: string | null; html_url?: string };
const job = (name: string, conclusion: string | null): Job => ({
  name,
  status: conclusion ? "completed" : "in_progress",
  conclusion,
});

const withApi = async (
  options: {
    jobs?: Job[];
    event?: string;
    attempt?: number;
    error?: boolean;
    changeAttempt?: boolean;
    cancelStatus?: number;
  },
  run: (fixture: { env: Record<string, string>; calls: string[]; cancelCount: () => number }) => Promise<void>,
) => {
  const calls: string[] = [];
  let cancellations = 0;
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const { pathname, searchParams } = new URL(request.url);
      calls.push(`${request.method} ${pathname}${new URL(request.url).search}`);
      expect(request.headers.get("authorization")).toBe("Bearer fixture-token");
      if (options.error) return new Response("Unavailable", { status: 503 });
      if (pathname.endsWith("/cancel")) {
        cancellations++;
        return new Response(null, { status: options.cancelStatus ?? 202 });
      }
      if (pathname.endsWith("/jobs")) {
        const jobs = options.jobs ?? [job("build_clients (darwin-x64)", "failure"), job("e2e (3)", null)];
        const page = Number(searchParams.get("page"));
        return Response.json({ total_count: jobs.length, jobs: jobs.slice((page - 1) * 100, page * 100) });
      }
      reads++;
      return Response.json({
        event: options.event ?? "merge_group",
        run_attempt: options.changeAttempt && reads > 1 ? 2 : (options.attempt ?? 1),
        status: "in_progress",
      });
    },
  });
  try {
    await run({
      env: {
        GITHUB_EVENT_NAME: "merge_group",
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_RUN_ID: "42",
        GITHUB_RUN_ATTEMPT: "1",
        GITHUB_API_URL: server.url.origin,
        GH_TOKEN: "fixture-token",
      },
      calls,
      cancelCount: () => cancellations,
    });
  } finally {
    await server.stop(true);
  }
};

test("a terminal queue failure cancels remaining unrelated validation in the same run", async () => {
  await withApi({}, async ({ env, cancelCount, calls }) => {
    await monitorMergeQueue(env);
    expect(cancelCount()).toBe(1);
    expect(calls).toContain("GET /repos/owner/repo/actions/runs/42/attempts/1/jobs?per_page=100&page=1");
    expect(calls.at(-1)).toBe("POST /repos/owner/repo/actions/runs/42/cancel");
  });
});

test("PR and main runs never query or cancel jobs", async () => {
  await withApi({}, async ({ env, calls }) => {
    for (const event of ["pull_request", "push", "workflow_dispatch"]) {
      await monitorMergeQueue({ ...env, GITHUB_EVENT_NAME: event });
    }
    expect(calls).toEqual([]);
  });
});

test("failure detection includes jobs beyond the first API page", async () => {
  await withApi(
    { jobs: [...Array.from({ length: 100 }, (_, index) => job(`test ${index}`, "success")), job("native", "failure")] },
    async ({ env, cancelCount, calls }) => {
      await monitorMergeQueue(env);
      expect(cancelCount()).toBe(1);
      expect(calls.some((call) => call.endsWith("page=2"))).toBe(true);
    },
  );
});

test("a successful gate finishes monitoring without cancelling", async () => {
  await withApi({ jobs: [job("ci_passed", "success")] }, async ({ env, cancelCount }) => {
    await monitorMergeQueue(env);
    expect(cancelCount()).toBe(0);
  });
});

test("the monitor waits for terminal results without treating pending work as failure", async () => {
  const jobs = [job("ci_passed", null), job("tests", null)];
  await withApi({ jobs }, async ({ env, cancelCount }) => {
    let waits = 0;
    await monitorMergeQueue(env, async () => {
      waits++;
      Object.assign(jobs[0], job("ci_passed", "success"));
      Object.assign(jobs[1], job("tests", "success"));
    });
    expect(waits).toBe(1);
    expect(cancelCount()).toBe(0);
  });
});

test("API identity and attempt guards prevent cancelling a PR or a newer rerun", async () => {
  for (const options of [{ event: "pull_request" }, { attempt: 2 }, { changeAttempt: true }]) {
    await withApi(options, async ({ env, cancelCount }) => {
      await monitorMergeQueue(env);
      expect(cancelCount()).toBe(0);
    });
  }
});

test("an unavailable monitoring API cannot cancel work or replace the final validation gate", async () => {
  await withApi({ error: true }, async ({ env, cancelCount }) => {
    await expect(monitorMergeQueue(env)).rejects.toThrow("503");
    expect(cancelCount()).toBe(0);
  });
});

for (const conclusion of ["cancelled", "timed_out", "startup_failure"]) {
  test(`a terminal ${conclusion} job stops the queue run`, async () => {
    await withApi({ jobs: [job("native", conclusion)] }, async ({ env, cancelCount }) => {
      await monitorMergeQueue(env);
      expect(cancelCount()).toBe(1);
    });
  });
}

test("a cancellation racing with completed work accepts HTTP 409", async () => {
  await withApi({ cancelStatus: 409 }, async ({ env, cancelCount }) => {
    await monitorMergeQueue(env);
    expect(cancelCount()).toBe(1);
  });
});

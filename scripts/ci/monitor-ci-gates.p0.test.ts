import { expect, test } from "bun:test";
import { monitorCiGates } from "./monitor-ci-gates";

test("the real results API reports P1 early without cancelling P0 work", async () => {
  const methods: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      methods.push(request.method);
      if (new URL(request.url).pathname.endsWith("/jobs"))
        return Response.json({
          total_count: 3,
          jobs: [
            { id: 1, name: "package_checks", status: "in_progress", conclusion: null },
            { id: 2, name: "e2e (1)", status: "completed", conclusion: "failure" },
            { id: 3, name: "validation_results", status: "in_progress", conclusion: null },
          ],
        });
      return Response.json({ run_attempt: 1, head_sha: "a".repeat(40) });
    },
  });
  try {
    const result = await monitorCiGates(
      {
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_RUN_ID: "42",
        GITHUB_RUN_ATTEMPT: "1",
        GH_TOKEN: "fixture",
        GITHUB_API_URL: server.url.origin,
      },
      [
        { id: "package_checks", count: 1 },
        { id: "e2e", count: 1 },
      ],
    );
    expect(result.outcome).toBe("failure");
    expect(result.jobs[0]?.status).toBe("in_progress");
    expect(methods).toEqual(["GET", "GET"]);
  } finally {
    await server.stop(true);
  }
});

test("P0 failures are collected after slower independent results finish", async () => {
  let finished = false;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname.endsWith("/jobs"))
        return Response.json({
          total_count: 3,
          jobs: [
            { id: 1, name: "package_checks", status: "completed", conclusion: "failure" },
            {
              id: 2,
              name: "license_check",
              status: finished ? "completed" : "in_progress",
              conclusion: finished ? "failure" : null,
            },
            { id: 3, name: "validation_results", status: "in_progress", conclusion: null },
          ],
        });
      return Response.json({ run_attempt: 1, head_sha: "a".repeat(40) });
    },
  });
  try {
    let waits = 0;
    const result = await monitorCiGates(
      {
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_RUN_ID: "42",
        GITHUB_RUN_ATTEMPT: "1",
        GH_TOKEN: "fixture",
        GITHUB_API_URL: server.url.origin,
      },
      [
        { id: "package_checks", count: 1 },
        { id: "license_check", count: 1 },
      ],
      async () => {
        waits++;
        finished = true;
      },
    );
    expect(waits).toBe(1);
    expect(result.failures).toHaveLength(2);
  } finally {
    await server.stop(true);
  }
});

test("a missing selected group fails after its own suite settles without waiting for its caller", async () => {
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname.endsWith("/jobs"))
        return Response.json({
          total_count: 3,
          jobs: [
            { id: 1, name: "functional / package_checks", status: "completed", conclusion: "success" },
            { id: 2, name: "functional / validation_results", status: "in_progress", conclusion: null },
            { id: 3, name: "certify", status: "queued", conclusion: null },
          ],
        });
      return Response.json({ run_attempt: 1, head_sha: "a".repeat(40) });
    },
  });
  try {
    let waits = 0;
    const result = await monitorCiGates(
      {
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_RUN_ID: "42",
        GITHUB_RUN_ATTEMPT: "1",
        GH_TOKEN: "fixture",
        CI_PROFILE: "production",
        GITHUB_API_URL: server.url.origin,
      },
      [
        { id: "package_checks", count: 1 },
        { id: "license_check", count: 1 },
      ],
      async () => {
        waits++;
      },
    );
    expect(waits).toBe(1);
    expect(result.outcome).toBe("failure");
    expect(result.failures.join(" ")).toContain("license_check");
  } finally {
    await server.stop(true);
  }
});

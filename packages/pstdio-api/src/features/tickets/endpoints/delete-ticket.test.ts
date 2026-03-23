import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TicketsTestContext } from "./tickets-test-harness";
import { createTicketsTestContext } from "./tickets-test-harness";

let context!: TicketsTestContext;

beforeAll(async () => {
  context = await createTicketsTestContext();
});

afterAll(() => {
  context.cleanup();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate: () => Promise<boolean>, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error("waitFor timed out");
    await sleep(50);
  }
};

const waitForFile = async (path: string, timeoutMs = 5000) => {
  await waitFor(async () => existsSync(path), timeoutMs);
};

const registerRepo = async (name: string) => {
  const { app, projectId, createGitRepo } = context;
  const repoRoot = createGitRepo(name);

  const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, path: repoRoot }),
  });

  expect(repoRes.status).toBe(201);
  return repoRoot;
};

const createTicket = async (body: Record<string, unknown> = {}) => {
  const { app, projectId } = context;
  const res = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, ...body }),
  });

  expect(res.status).toBe(201);
  return res.json();
};

describe("DELETE /v1/tickets/:id", () => {
  test("runs delete hook with ticket metadata after deletion", async () => {
    const repoRoot = await registerRepo("ticket-delete-hook-repo");
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(
      join(hooksDir, "post-ticket-delete"),
      'echo "$PSTDIO_TICKET_ID|$PSTDIO_TICKET_SHORTHAND|$PSTDIO_TICKET_DELETED_AT" > delete-hook.txt',
    );

    const created = await createTicket({ content: "delete hook ticket" });

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);

    const markerPath = join(repoRoot, "delete-hook.txt");
    await waitForFile(markerPath);

    const hookOutput = readFileSync(markerPath, "utf8");
    expect(hookOutput).toContain(created.id);
    expect(hookOutput).toContain(created.shorthand);
    expect(hookOutput).toContain("T");
  });

  test("returns success when delete hook fails and logs the failure", async () => {
    const repoRoot = await registerRepo("ticket-delete-hook-failure-repo");
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, "post-ticket-delete"), 'echo "delete hook failed" >&2; exit 5');

    const created = await createTicket({ content: "delete hook failure ticket" });
    const stderrSpy = spyOn(process.stderr, "write").mockReturnValue(true);

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);

    await waitFor(async () =>
      stderrSpy.mock.calls.some(
        (call) => String(call[0]).includes("post-ticket-delete") && String(call[0]).includes("delete hook failed"),
      ),
    );

    stderrSpy.mockRestore();
  });

  test("returns 404 for non-existent ticket", async () => {
    const { app } = context;
    const res = await app.request("/v1/tickets/non-existent", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });

  test("skips hooks when skip_hooks=true", async () => {
    const repoRoot = await registerRepo("ticket-delete-skip-hooks-repo");
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    const markerPath = join(repoRoot, "delete-skip-marker.txt");
    writeFileSync(join(hooksDir, "post-ticket-delete"), `echo "ran" > "${markerPath}"`);

    const created = await createTicket({ content: "skip hooks delete ticket" });

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}?skip_hooks=true`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    await sleep(200);
    expect(existsSync(markerPath)).toBe(false);
  });
});

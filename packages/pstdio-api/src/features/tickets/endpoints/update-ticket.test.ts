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

const getStatusIds = async () => {
  const { app, projectId } = context;
  const res = await app.request(`/v1/projects/${projectId}/ticket-statuses`);
  expect(res.status).toBe(200);
  const statuses = (await res.json()) as Array<{ id: string; is_default: boolean }>;
  const defaultStatus = statuses.find((item) => item.is_default) ?? statuses[0];
  if (!defaultStatus) throw new Error("No ticket statuses found");

  const nextStatus = statuses.find((item) => item.id !== defaultStatus.id);
  if (!nextStatus) throw new Error("Need at least two ticket statuses for this test");

  return { defaultStatusId: defaultStatus.id, nextStatusId: nextStatus.id };
};

describe("PATCH /v1/tickets/:id", () => {
  test("updates ticket display_title", async () => {
    const created = await createTicket({ content: "Original title" });

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_title: "Updated title" }),
    });

    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.display_title).toBe("Updated title");
  });

  test("returns 404 for non-existent ticket", async () => {
    const { app } = context;
    const res = await app.request("/v1/tickets/non-existent", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_title: "Nope" }),
    });
    expect(res.status).toBe(404);
  });

  test("updates canonical content file and derived display_title when content is provided", async () => {
    const created = await createTicket({ content: "# Original title\n\nOriginal body" });
    expect(created.file_id).not.toBeNull();

    const { app } = context;
    const updatedContent = "# Updated title\n\nUpdated body";
    const updateRes = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: updatedContent }),
    });

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.display_title).toBe("Updated title");
    expect(updated.file_id).not.toBeNull();
    expect(updated.file_id).toBe(created.file_id);

    const fileRes = await app.request(`/v1/tickets/${created.id}/files/${updated.file_id}/content`);
    expect(fileRes.status).toBe(200);
    expect(await fileRes.text()).toBe(updatedContent);
  });

  test("runs status-change hook when status changes", async () => {
    const { defaultStatusId, nextStatusId } = await getStatusIds();
    const repoRoot = await registerRepo("ticket-status-hook-repo");
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(
      join(hooksDir, "on-ticket-status-change"),
      'echo "$PSTDIO_TICKET_SHORTHAND|$PSTDIO_TICKET_STATUS_OLD|$PSTDIO_TICKET_STATUS_NEW" > status-hook.txt',
    );

    const created = await createTicket({ content: "status hook ticket", status_id: defaultStatusId });

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status_id: nextStatusId }),
    });

    expect(res.status).toBe(200);

    const markerPath = join(repoRoot, "status-hook.txt");
    await waitForFile(markerPath);
    expect(readFileSync(markerPath, "utf8")).toContain(`${created.shorthand}|${defaultStatusId}|${nextStatusId}`);
  });

  test("does not run status-change hook when status remains unchanged", async () => {
    const { defaultStatusId } = await getStatusIds();
    const repoRoot = await registerRepo("ticket-status-unchanged-repo");
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    const markerPath = join(repoRoot, "status-hook-unchanged.txt");
    writeFileSync(join(hooksDir, "on-ticket-status-change"), `echo "$PSTDIO_TICKET_STATUS_NEW" > "${markerPath}"`);

    const created = await createTicket({ content: "status unchanged ticket", status_id: defaultStatusId });

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status_id: defaultStatusId, display_title: "still todo" }),
    });

    expect(res.status).toBe(200);
    await sleep(200);
    expect(existsSync(markerPath)).toBe(false);
  });

  test("runs both status and archive hooks when both transition in one update", async () => {
    const { defaultStatusId, nextStatusId } = await getStatusIds();
    const repoRoot = await registerRepo("ticket-multi-hook-repo");
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(
      join(hooksDir, "on-ticket-status-change"),
      'echo "status:$PSTDIO_TICKET_STATUS_NEW" > status-combined.txt',
    );
    writeFileSync(
      join(hooksDir, "on-ticket-archive"),
      'echo "archive:$PSTDIO_TICKET_ARCHIVED_AT" > archive-combined.txt',
    );

    const created = await createTicket({ content: "combined hook ticket", status_id: defaultStatusId });

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status_id: nextStatusId, archived: true }),
    });

    expect(res.status).toBe(200);
    const statusPath = join(repoRoot, "status-combined.txt");
    const archivePath = join(repoRoot, "archive-combined.txt");

    await waitForFile(statusPath);
    await waitForFile(archivePath);

    expect(readFileSync(statusPath, "utf8")).toContain(`status:${nextStatusId}`);
    expect(readFileSync(archivePath, "utf8")).toContain("archive:");
  });

  test("returns success when status-change hook fails and logs the failure", async () => {
    const { defaultStatusId, nextStatusId } = await getStatusIds();
    const repoRoot = await registerRepo("ticket-hook-failure-repo");
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, "on-ticket-status-change"), 'echo "hook failed" >&2; exit 7');

    const created = await createTicket({ content: "hook failure ticket", status_id: defaultStatusId });
    const stderrSpy = spyOn(process.stderr, "write").mockReturnValue(true);

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status_id: nextStatusId }),
    });

    expect(res.status).toBe(200);

    await waitFor(async () =>
      stderrSpy.mock.calls.some(
        (call) => String(call[0]).includes("on-ticket-status-change") && String(call[0]).includes("hook failed"),
      ),
    );

    stderrSpy.mockRestore();
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TicketsTestContext } from "../../tickets/endpoints/tickets-test-harness";
import { createTicketsTestContext } from "../../tickets/endpoints/tickets-test-harness";

let context!: TicketsTestContext;

beforeEach(async () => {
  context = await createTicketsTestContext();
});

afterEach(() => {
  context.cleanup();
});

const linkRepo = async (repoRoot: string) => {
  const response = await context.app.request(`/v1/projects/${context.projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path: repoRoot }),
  });

  expect(response.status).toBe(201);
};

const createTicket = async (content: string) => {
  const response = await context.app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: context.projectId, content }),
  });

  expect(response.status).toBe(201);
  return response.json();
};

const createStatus = async (name: string) => {
  const response = await context.app.request(`/v1/projects/${context.projectId}/statuses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, color: "#112233" }),
  });

  expect(response.status).toBe(201);
  return response.json();
};

const readPersistedTicketContent = async (ticketId: string) => {
  const detailResponse = await context.app.request(`/v1/tickets/${ticketId}`);
  expect(detailResponse.status).toBe(200);
  const detail = await detailResponse.json();

  const contentResponse = await context.app.request(`/v1/tickets/${ticketId}/files/${detail.file_id}/content`);
  expect(contentResponse.status).toBe(200);
  return { detail, content: await contentResponse.text() };
};

describe("planner ticket source API", () => {
  test("pulls planner tickets through the planner boundary into repo artifacts", async () => {
    const repoRoot = context.createGitRepo("planner-pull-repo");
    await linkRepo(repoRoot);
    const ticket = await createTicket("# Planner boundary\n\nPulled through pstdio-ext-planner.");

    const response = await context.app.request(`/v1/projects/${context.projectId}/planner/tickets/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket_id: ticket.shorthand, force: true }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      pulled_ticket_shorthands: [ticket.shorthand],
      downloaded_file_count: 0,
      messages: [`Pulled ticket ${ticket.shorthand} to .pstdio/tickets/${ticket.shorthand}`],
    });

    const ticketPath = join(repoRoot, ".pstdio", "tickets", ticket.shorthand, "ticket.md");
    expect(existsSync(ticketPath)).toBe(true);
    expect(readFileSync(ticketPath, "utf8")).toContain("Pulled through pstdio-ext-planner.");
  });

  test("pushes local ticket artifacts through the planner boundary into persisted ticket content", async () => {
    const repoRoot = context.createGitRepo("planner-push-repo");
    await linkRepo(repoRoot);
    const ticket = await createTicket("# Original title\n\nOriginal body.");

    const pullResponse = await context.app.request(`/v1/projects/${context.projectId}/planner/tickets/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket_id: ticket.shorthand, force: true }),
    });
    expect(pullResponse.status).toBe(200);

    const ticketPath = join(repoRoot, ".pstdio", "tickets", ticket.shorthand, "ticket.md");
    writeFileSync(
      ticketPath,
      readFileSync(ticketPath, "utf8").replace(
        "# Original title\n\nOriginal body.",
        "# Updated title\n\nUpdated body.",
      ),
    );

    const pushResponse = await context.app.request(`/v1/projects/${context.projectId}/planner/tickets/push`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket_id: ticket.shorthand }),
    });

    expect(pushResponse.status).toBe(200);
    expect(await pushResponse.json()).toEqual({
      ticket_id: ticket.shorthand,
      uploaded_file_count: 0,
      messages: [`Saved ticket ${ticket.shorthand}`],
    });

    const detailResponse = await context.app.request(`/v1/tickets/${ticket.id}`);
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json();

    const contentResponse = await context.app.request(`/v1/tickets/${ticket.id}/files/${detail.file_id}/content`);
    expect(contentResponse.status).toBe(200);
    expect(await contentResponse.text()).toBe("# Updated title\n\nUpdated body.");
  });

  test("pushes ticket content from the caller repo path", async () => {
    const linkedRepoRoot = context.createGitRepo("planner-linked-repo");
    const callerRepoRoot = context.createGitRepo("planner-caller-repo");
    await linkRepo(linkedRepoRoot);
    const ticket = await createTicket("# Original title\n\nOriginal body.");

    const ticketDir = join(callerRepoRoot, ".pstdio", "tickets", ticket.shorthand);
    mkdirSync(ticketDir, { recursive: true });
    writeFileSync(join(ticketDir, "ticket.md"), "# Caller title\n\nCaller body.");

    const pushResponse = await context.app.request(`/v1/projects/${context.projectId}/planner/tickets/push`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket_id: ticket.shorthand, repo_path: callerRepoRoot }),
    });

    expect(pushResponse.status).toBe(200);

    const detailResponse = await context.app.request(`/v1/tickets/${ticket.id}`);
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json();

    const contentResponse = await context.app.request(`/v1/tickets/${ticket.id}/files/${detail.file_id}/content`);
    expect(contentResponse.status).toBe(200);
    expect(await contentResponse.text()).toBe("# Caller title\n\nCaller body.");
  });

  test("does not persist content or status when a status-change hook rejects planner push", async () => {
    const repoRoot = context.createGitRepo("planner-hook-reject-repo");
    await linkRepo(repoRoot);

    const pluginsDir = join(repoRoot, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(
      join(pluginsDir, "pre-ticket-status-guard.ts"),
      `export default { hooks: { preTicketStatusChange: () => ({ reject: true, reason: "rejected" }) } };`,
    );

    const ticket = await createTicket("# Original title\n\nOriginal body.");
    const targetStatus = await createStatus("Hook Blocked");

    const pullResponse = await context.app.request(`/v1/projects/${context.projectId}/planner/tickets/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket_id: ticket.shorthand, force: true }),
    });
    expect(pullResponse.status).toBe(200);

    const ticketPath = join(repoRoot, ".pstdio", "tickets", ticket.shorthand, "ticket.md");
    writeFileSync(
      ticketPath,
      readFileSync(ticketPath, "utf8").replace(
        "# Original title\n\nOriginal body.",
        "# Rejected title\n\nRejected body.",
      ),
    );

    const pushResponse = await context.app.request(`/v1/projects/${context.projectId}/planner/tickets/push`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket_id: ticket.shorthand, status: targetStatus.name }),
    });

    expect(pushResponse.status).toBe(400);
    expect((await pushResponse.json()).error).toContain("rejected");

    const persisted = await readPersistedTicketContent(ticket.id);
    expect(persisted.detail.status_id).toBe(ticket.status_id);
    expect(persisted.content).toBe("# Original title\n\nOriginal body.");
  });

  test("returns an actionable diagnostic when the planner extension is disabled", async () => {
    const repoRoot = context.createGitRepo("planner-disabled-repo");
    await linkRepo(repoRoot);

    await context.deps.extensionInstanceService.create({
      project_id: context.projectId,
      extension_id: "pstdio.planner",
      display_name: "Planner",
      source_kind: "package",
      package_name: "@pstdio/pstdio-ext-planner",
      enabled: false,
    });

    const response = await context.app.request(`/v1/projects/${context.projectId}/planner/tickets/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('extension "pstdio.planner" is disabled');
    expect(body.error).toContain('Enable "@pstdio/pstdio-ext-planner"');
    expect(body.error).toContain("pstdio extensions check");
  });
});

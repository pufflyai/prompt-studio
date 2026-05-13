import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";

let handle: Awaited<ReturnType<typeof createApp>>;
let tempRoot: string;

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-delete-ticket-test-"));
  handle = await createApp({ dbPath: ":memory:", storagePath: join(tempRoot, "storage"), filesRoot: "" });
});

afterEach(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

const createProject = async () => {
  const res = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Tickets" }),
  });
  return res.json() as Promise<{ id: string }>;
};

const createTicket = async (projectId: string) => {
  const res = await handle.app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, content: "test ticket" }),
  });
  return res.json() as Promise<{ id: string }>;
};

const writeRejectingExtension = (repoPath: string) => {
  const extensionRoot = join(repoPath, ".pstdio", "extensions", "guard");
  mkdirSync(extensionRoot, { recursive: true });
  writeFileSync(
    join(extensionRoot, "package.json"),
    JSON.stringify({
      name: "guard",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(
    join(extensionRoot, "extension.ts"),
    `export default {
      hooks: {
        preDelete: {
          eventId: "kernel.preTicketDeletion",
          handler() { throw new Error("blocked by extension"); }
        }
      }
    };`,
  );
};

describe("DELETE /v1/tickets/:id", () => {
  test("rejects when a repo-local extension pre-delete hook fails", async () => {
    const project = await createProject();
    const repoPath = join(tempRoot, "repo");
    writeRejectingExtension(repoPath);
    const repoRes = await handle.app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "repo", path: repoPath }),
    });
    expect(repoRes.status).toBe(201);
    const ticket = await createTicket(project.id);

    const deleteRes = await handle.app.request(`/v1/tickets/${ticket.id}`, { method: "DELETE" });

    expect(deleteRes.status).toBe(403);
    const body = (await deleteRes.json()) as { error: string };
    expect(body.error).toContain("blocked by extension");
  });
});

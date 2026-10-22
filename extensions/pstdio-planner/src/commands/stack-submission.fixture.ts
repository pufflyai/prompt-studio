import { expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putAttempt } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { putTicket } from "../data/collections";
import { seedDefaultStatuses } from "../data/seed";
import { makeCommandContext } from "./command-context.fixture";
import { sessionQuery } from "./session-query.fixture";

export async function stackSubmissionFixture() {
  const path = await mkdtemp(join(tmpdir(), "planner-stack-"));
  const run = async (command: string[], cwd = path) => {
    const child = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, exitCode };
  };
  const git = async (...args: string[]) => {
    const result = await run(["git", ...args]);
    if (result.exitCode) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  await git("init", "-b", "main");
  await git("config", "user.name", "Planner test");
  await git("config", "user.email", "planner-test@example.invalid");
  await git("commit", "--allow-empty", "-m", "Base");
  const base = await git("rev-parse", "HEAD");
  const storage = createMemoryStorage();
  await seedDefaultStatuses(storage);
  const now = new Date().toISOString();
  const ticket = async (id: string, dependsOn: string[] = []) =>
    putTicket(storage, {
      id,
      shorthand: id,
      title: id,
      content: id,
      statusId: "in-progress",
      dependsOn,
      archived: false,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
  await ticket("Child");
  const attempt: AttemptRecord = {
    schemaVersion: 2,
    workspaceId: "child",
    workspaceShorthand: "Child_A1",
    ticketId: "Child",
    ticketShorthand: "Child",
    implementationSessionId: "owner",
    base: { workspaceId: null, headSha: base },
    revisions: [],
    blocker: null,
    implementationDisconnectRetries: 0,
    reviewDisconnectRetries: 0,
    createdAt: now,
    updatedAt: now,
  };
  await putAttempt(storage, attempt);
  const workspace = {
    id: "child",
    root_path: path,
    execution_kind: "local" as const,
    provider_capabilities_json: { diff: true },
  };
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      workspaces: {
        list: async () => [],
        get: async (id: string) => ({ ...workspace, id }),
        getDefault: async () => workspace,
      } as never,
      process: {
        run: async ({ command, cwd }: { command: string[]; cwd?: string }) => run(command, cwd ?? path),
      } as never,
      commands: {
        execute: async (_ref: unknown, input: { params?: unknown }) => ({
          ok: true,
          status: "success",
          value: {
            id: (input.params as { id: string }).id,
            workspaceId: "child",
            draft: false,
          },
        }),
      } as never,
      sessions: {
        query: sessionQuery(
          async () => [],
          async () => [{ type: "session", id: "owner", title: "Owner", status: "completed" }],
        ),
        get: async (id: string) => ({ type: "session", id, title: id, status: "completed" }),
      } as never,
    },
  });
  const commit = async (name: string) => {
    await Bun.write(join(path, name), name);
    await git("add", name);
    await git("commit", "-m", name);
    return git("rev-parse", "HEAD");
  };
  const params = async () => ({
    workspaceId: "child",
    implementationSessionId: "owner",
    headSha: await git("rev-parse", "HEAD"),
    changeRequestReportId: "report",
    expectedAttemptState: "implementing" as const,
  });
  return {
    path,
    ctx,
    storage,
    attempt,
    base,
    git,
    commit,
    ticket,
    params,
    cleanup: () => rm(path, { recursive: true, force: true }),
  };
}

export async function expectProcessFailure(operation: unknown, message: string) {
  const error = await Promise.resolve(operation).catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(Error);
  expect(error).toMatchObject({ message: expect.stringContaining(message) });
}

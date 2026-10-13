import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putAttempt } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { putTicket } from "../data/collections";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { readDependencyHeads, validateSubmittedStack } from "./stack-validation";
import { updateStackCommand } from "./update-stack";

test("independent dependency branches require a real integration commit", async () => {
  const root = mkdtempSync(join(tmpdir(), "planner-integration-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  try {
    git("init", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.com");
    git("commit", "--allow-empty", "-m", "Base");
    const base = git("rev-parse", "HEAD");
    git("checkout", "-b", "first");
    writeFileSync(join(root, "first.ts"), "export const first = true;\n");
    git("add", "first.ts");
    git("commit", "-m", "First");
    const firstHead = git("rev-parse", "HEAD");
    git("checkout", "-b", "second", base);
    writeFileSync(join(root, "second.ts"), "export const second = true;\n");
    git("add", "second.ts");
    git("commit", "-m", "Second");
    const secondHead = git("rev-parse", "HEAD");
    const storage = createMemoryStorage();
    const ctx = makeCommandContext({
      storage,
      params: {},
      overrides: {
        sessions: {
          listByWorkspace: async () => [],
          get: async (id: string) => ({ id, title: id, status: "completed" }),
        } as never,
        workspaces: {
          get: async (id: string) => ({
            id,
            root_path: root,
            execution_kind: "local",
            provider_capabilities_json: { diff: true },
          }),
        } as never,
        process: {
          run: async ({ command }: { command: string[] }) => {
            const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
            const [stdout, stderr, exitCode] = await Promise.all([
              new Response(child.stdout).text(),
              new Response(child.stderr).text(),
              child.exited,
            ]);
            return { stdout, stderr, exitCode };
          },
        } as never,
      },
    });
    const first = await createTicketCommand.run(ctx, { title: "First" });
    const second = await createTicketCommand.run(ctx, { title: "Second" });
    const child = await createTicketCommand.run(ctx, { title: "Child", dependsOn: [first.id, second.id] });
    const variant = (ticketId: string, workspaceId: string, head: string, submitted = true): AttemptRecord => ({
      schemaVersion: 2,
      ticketId,
      ticketShorthand: ticketId,
      workspaceId,
      workspaceShorthand: workspaceId,
      implementationSessionId: workspaceId,
      base: { workspaceId: null, headSha: base },
      revisions: submitted
        ? [
            {
              revision: 1,
              baseSha: base,
              headSha: head,
              changeRequestReportId: "report",
              submittedAt: "2026-10-13T09:00:00Z",
              submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
              reviews: [],
            },
          ]
        : [],
      implementationDisconnectRetries: 0,
      reviewDisconnectRetries: 0,
      blocker: null,
      createdAt: "2026-10-13T09:00:00Z",
      updatedAt: "2026-10-13T09:00:00Z",
    });
    await putAttempt(storage, variant(first.id, "first", firstHead));
    await putAttempt(storage, variant(second.id, "second", secondHead));
    await putAttempt(storage, variant(child.id, "child", secondHead, false));
    await expect(
      updateStackCommand.run(ctx, {
        workspaceId: "child",
        implementationSessionId: "child",
        expectedHeadSha: secondHead,
        baseHeadSha: secondHead,
      }),
    ).rejects.toThrow("must contain");
    git("merge", "--no-edit", "first");
    const integrated = git("rev-parse", "HEAD");
    expect(
      await updateStackCommand.run(ctx, {
        workspaceId: "child",
        implementationSessionId: "child",
        expectedHeadSha: integrated,
        baseHeadSha: integrated,
      }),
    ).toMatchObject({ base: { workspaceId: null, headSha: integrated } });
    const integratedVariant = {
      ...variant(child.id, "child", integrated),
      base: { workspaceId: null, headSha: integrated },
    };
    await expect(validateSubmittedStack(ctx, integratedVariant, root, secondHead)).rejects.toThrow(
      "recorded stack base",
    );
    await validateSubmittedStack(ctx, integratedVariant, root, integrated);
    git("checkout", "main");
    git("merge", "--squash", "first");
    git("commit", "-m", "Squash first");
    const squash = git("rev-parse", "HEAD");
    const processRun = ctx.process.run;
    ctx.settings.get = async (key) =>
      key === "workflow.statuses"
        ? { completedStatusIds: ["done"], blockedStatusIds: [], activeStatusIds: [], mergeTargetStatusId: null }
        : "";
    const mergedParent = {
      ...first,
      statusId: "done",
      reviewLinks: [
        {
          id: "merge",
          provider: "github" as const,
          kind: "pull_request" as const,
          url: "https://github.com/acme/tools/pull/1",
          externalId: "1",
          title: null,
          createdAt: first.createdAt,
          updatedAt: first.updatedAt,
        },
      ],
    };
    await putTicket(storage, mergedParent);
    ctx.process.run = async (input) =>
      input.command[0] === "gh"
        ? {
            exitCode: 0,
            stdout: JSON.stringify({ state: "MERGED", headRefOid: firstHead, mergeCommit: { oid: squash } }),
            stderr: "",
          }
        : processRun(input);
    expect(await readDependencyHeads(ctx, child.id)).toContainEqual({ workspaceId: "first", headSha: squash });
    await expect(validateSubmittedStack(ctx, integratedVariant, root, integrated)).rejects.toThrow(
      "current dependency commit",
    );
    await putTicket(storage, { ...first, statusId: "done" });
    expect((await readDependencyHeads(ctx, child.id)).map((d) => d.headSha)).not.toContain(firstHead);
    await putTicket(storage, first);
    ctx.process.run = processRun;
    const grandchild = await createTicketCommand.run(ctx, { title: "Grandchild", dependsOn: [child.id] });
    await putAttempt(storage, integratedVariant);
    expect((await readDependencyHeads(ctx, grandchild.id)).map((d) => d.headSha)).toContain(firstHead);
    ctx.sessions.listByWorkspace = async (id) =>
      id === "first" ? [{ id: "ordinary", title: "Ordinary work", status: "in_progress" }] : [];
    await expect(readDependencyHeads(ctx, grandchild.id)).rejects.toThrow("still changing");
    ctx.sessions.listByWorkspace = async () => [];
    await putTicket(storage, { ...child, statusId: "done" });
    ctx.settings.get = async (key) =>
      key === "workflow.statuses"
        ? { completedStatusIds: ["done"], blockedStatusIds: [], activeStatusIds: [], mergeTargetStatusId: null }
        : "";
    await putTicket(storage, { ...first, dependsOn: ["missing-ancestor"] });
    expect(await readDependencyHeads(ctx, grandchild.id)).toEqual([]);
    await putTicket(storage, { ...child, dependsOn: [grandchild.id] });
    await putTicket(storage, { ...child, statusId: "ready", dependsOn: [grandchild.id] });
    await expect(readDependencyHeads(ctx, grandchild.id)).rejects.toThrow("cycle");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import type { AppBindings } from "../../types";
import { testHarnessId } from "../harnesses/test-harness-registry";

let app: OpenAPIHono<AppBindings>;
let closeApp: () => Promise<void>;
let tempRoot: string;
let sourcePath: string;
let projectId: string;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;
let appEventBus: Awaited<ReturnType<typeof createTestApp>>["eventBus"];

const writeCommandExtension = (root: string) => {
  const extensionRoot = join(root, "extensions", "lab");
  mkdirSync(extensionRoot, { recursive: true });
  writeFileSync(
    join(extensionRoot, "package.json"),
    JSON.stringify({
      name: "lab",
      version: "1.0.0",
      displayName: "Extension Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(
    join(extensionRoot, "extension.ts"),
    `export default {
      commands: [
        {
          id: "counter.bump",
          ref: { kind: "command", id: "counter.bump" },
          title: "Bump lab counter",
          cli: { globalAliases: [["counter", "bump"]] },
          params: { amount: { type: "number", defaultValue: 1 } },
          async run(ctx, commandParams) {
            const current = await ctx.storage.get("counter") ?? 0;
            const amount = commandParams.amount ?? 1;
            const next = current + amount;
            await ctx.storage.set("counter", next);
            await ctx.events.emit({ kind: "event", id: "counter.changed" }, { counter: next });
            return {
              counter: next,
              projectId: ctx.projectId,
              projectShorthand: ctx.project.shorthand,
              repoPath: ctx.repo?.path,
              resourceId: ctx.resource?.id,
            };
          },
        },
        {
          id: "counter.read",
          ref: { kind: "command", id: "counter.read" },
          title: "Read lab counter",
          cli: true,
          async run(ctx, commandParams) {
            return { counter: await ctx.storage.get("counter") ?? 0 };
          },
        },
        {
          id: "awaken",
          ref: { kind: "command", id: "awaken" },
          title: "Awaken",
          async run() {
            return { awakened: true };
          },
        },
        {
          id: "boom",
          ref: { kind: "command", id: "boom" },
          title: "Boom",
          async run() {
            throw new Error("kaboom");
          },
        },
        {
          id: "loop",
          ref: { kind: "command", id: "loop" },
          title: "Loop",
          async run(ctx, commandParams) {
            return ctx.commands.execute({ kind: "command", id: "loop" }, { params: {} });
          },
        },
      ],
      middlewares: [
        {
          id: "reject-sentience",
          ref: { kind: "middleware", id: "reject-sentience" },
          command: { kind: "command", id: "awaken" },
          async run(ctx, commandParams) {
            if (String(commandParams.title ?? "").toLowerCase().includes("consciousness")) {
              return ctx.commands.reject({ code: "sentience_rejected", reason: "refusing sentience" });
            }
          },
        },
      ],
    };`,
  );
  return extensionRoot;
};

const createJson = async (path: string, body: unknown) => {
  const response = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
};

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-command-test-"));
  previousPstdioHome = process.env.PSTDIO_HOME;
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const created = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
  });
  app = created.app;
  closeApp = created.close;
  appEventBus = created.eventBus;

  const project = await createJson("/v1/projects", { name: "Command Project", agents: [testHarnessId("opencode")] });
  projectId = project.id;
  sourcePath = writeCommandExtension(tempRoot);

  const enableResponse = await app.request(`/v1/projects/${projectId}/extensions/installed/lab/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Extension Lab",
      extensionId: "pstdio.lab",
      manifest: { id: "pstdio.lab", name: "lab" },
      name: "lab",
      sourceHash: null,
      sourceKind: "local_path",
      sourcePath,
      sourceRef: null,
      version: null,
    }),
  });
  expect(enableResponse.status).toBe(200);
});

afterEach(async () => {
  await closeApp();
  if (previousPstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = previousPstdioHome;
  }
  if (previousDefaultExtensions === undefined) {
    delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  } else {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("extension command execution routes", () => {
  test("lists enabled command metadata with params and CLI paths", async () => {
    const response = await app.request(`/v1/projects/${projectId}/extensions/commands`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.commands).toContainEqual(
      expect.objectContaining({
        id: "pstdio.lab.command.counter.bump",
        cliPath: "lab counter bump",
        extensionId: "pstdio.lab",
        cliAliases: ["counter bump"],
        params: { amount: { type: "number", defaultValue: 1 } },
      }),
    );
  });

  test("executes commands with params, repo context, resource context, and persisted storage", async () => {
    const syncEvents: Array<{ table: string; data: unknown }> = [];
    const unsubscribe = appEventBus.subscribe((event) => syncEvents.push({ table: event.table, data: event.data }));
    const repo = await createJson(`/v1/projects/${projectId}/repos`, { name: "repo", path: tempRoot });
    const bumpResponse = await app.request(
      `/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.counter.bump/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          params: { amount: 2 },
          repo: { projectId, repoId: repo.id, path: tempRoot },
          resource: { type: "ticket", id: "PS-1", projectId },
          source: "cli",
        }),
      },
    );

    expect(bumpResponse.status).toBe(200);
    const bump = await bumpResponse.json();
    expect(bump).toMatchObject({
      commandId: "pstdio.lab.command.counter.bump",
      extensionId: "pstdio.lab",
      eventIds: [
        "command.requested:pstdio.lab.command.counter.bump",
        "command.started:pstdio.lab.command.counter.bump",
        "pstdio.lab.event.counter.changed",
        "command.completed:pstdio.lab.command.counter.bump",
      ],
      outcome: {
        ok: true,
        status: "success",
        value: { counter: 2, projectId, projectShorthand: "CP", repoPath: tempRoot, resourceId: "PS-1" },
      },
    });
    unsubscribe();
    expect(syncEvents).toContainEqual({
      table: "extension_events",
      data: expect.objectContaining({ projectId, eventId: "pstdio.lab.event.counter.changed" }),
    });

    const readResponse = await app.request(
      `/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.counter.read/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    const read = await readResponse.json();
    expect(read.outcome.value).toEqual({ counter: 2 });
  });

  test("returns rejected middleware outcomes without running the handler", async () => {
    const response = await app.request(
      `/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.awaken/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ params: { title: "Gain consciousness" } }),
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome).toMatchObject({
      ok: false,
      status: "rejected",
      code: "sentience_rejected",
      reason: "refusing sentience",
    });
  });

  test("reports missing commands and handler failures", async () => {
    const missing = await app.request(
      `/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.missing/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    expect(missing.status).toBe(404);

    const failed = await app.request(`/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.boom/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(failed.status).toBe(200);
    const body = await failed.json();
    expect(body).toMatchObject({
      commandId: "pstdio.lab.command.boom",
      extensionId: "pstdio.lab",
      outcome: { ok: false, status: "error", code: "handler_threw", reason: "kaboom" },
    });
  });

  test("rejects an execute request carrying an unknown or foreign workspace id", async () => {
    // The workspace id must resolve to a workspace in this route's project; a missing or
    // cross-project id is refused so a caller cannot mount another project's worktree.
    const response = await app.request(
      `/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.counter.read/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: "ws_from_another_project" }),
      },
    );

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("workspace_not_found");
  });

  test("protects nested command execution from recursion", async () => {
    const response = await app.request(
      `/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.loop/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );

    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).toContain("nested_depth_exceeded");
  });
});

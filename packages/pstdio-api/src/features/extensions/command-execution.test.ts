import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../app";
import type { AppBindings } from "../../types";
import { testHarnessId } from "../harnesses/test-harness-registry";

let app: OpenAPIHono<AppBindings>;
let closeApp: () => Promise<void>;
let tempRoot: string;
let sourcePath: string;
let projectId: string;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;

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
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(
    join(extensionRoot, "extension.ts"),
    `export default {
      commands: {
        "counter.bump": {
          title: "Bump lab counter",
          cli: { globalAliases: [["counter", "bump"]] },
          params: { amount: { type: "number", defaultValue: 1 } },
          async run(ctx) {
            const current = await ctx.storage.get("counter") ?? 0;
            const amount = ctx.params.amount ?? 1;
            const next = current + amount;
            await ctx.storage.set("counter", next);
            return {
              counter: next,
              projectId: ctx.projectId,
              projectShorthand: ctx.project.shorthand,
              repoPath: ctx.repo?.path,
              resourceId: ctx.resource?.id,
            };
          },
        },
        "counter.read": {
          title: "Read lab counter",
          cli: true,
          async run(ctx) {
            return { counter: await ctx.storage.get("counter") ?? 0 };
          },
        },
        awaken: {
          title: "Awaken",
          async run() {
            return { awakened: true };
          },
        },
        boom: {
          title: "Boom",
          async run() {
            throw new Error("kaboom");
          },
        },
        loop: {
          title: "Loop",
          async run(ctx) {
            return ctx.commands.execute("lab.loop", { params: {} });
          },
        },
      },
      middlewares: {
        rejectSentience: {
          commandId: "lab.awaken",
          async handler(ctx) {
            if (String(ctx.params.title ?? "").toLowerCase().includes("consciousness")) {
              return ctx.commands.reject({ code: "sentience_rejected", reason: "refusing sentience" });
            }
          },
        },
      },
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
  const created = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });
  app = created.app;
  closeApp = created.close;

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
        id: "lab.counter.bump",
        cliPath: "lab counter bump",
        extensionId: "pstdio.lab",
        cliAliases: ["counter bump"],
        params: { amount: { type: "number", defaultValue: 1 } },
      }),
    );
  });

  test("executes commands with params, repo context, resource context, and persisted storage", async () => {
    const repo = await createJson(`/v1/projects/${projectId}/repos`, { name: "repo", path: tempRoot });
    const bumpResponse = await app.request(`/v1/projects/${projectId}/extensions/commands/lab.counter.bump/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        params: { amount: 2 },
        repo: { projectId, repoId: repo.id, path: tempRoot },
        resource: { type: "ticket", id: "PS-1", projectId },
        source: "cli",
      }),
    });

    expect(bumpResponse.status).toBe(200);
    const bump = await bumpResponse.json();
    expect(bump).toMatchObject({
      commandId: "lab.counter.bump",
      extensionId: "pstdio.lab",
      outcome: {
        ok: true,
        status: "success",
        value: { counter: 2, projectId, projectShorthand: "CP", repoPath: tempRoot, resourceId: "PS-1" },
      },
    });

    const readResponse = await app.request(`/v1/projects/${projectId}/extensions/commands/lab.counter.read/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const read = await readResponse.json();
    expect(read.outcome.value).toEqual({ counter: 2 });
  });

  test("returns rejected middleware outcomes without running the handler", async () => {
    const response = await app.request(`/v1/projects/${projectId}/extensions/commands/lab.awaken/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ params: { title: "Gain consciousness" } }),
    });

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
    const missing = await app.request(`/v1/projects/${projectId}/extensions/commands/lab.missing/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(missing.status).toBe(404);

    const failed = await app.request(`/v1/projects/${projectId}/extensions/commands/lab.boom/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(failed.status).toBe(200);
    const body = await failed.json();
    expect(body).toMatchObject({
      commandId: "lab.boom",
      extensionId: "pstdio.lab",
      outcome: { ok: false, status: "error", code: "handler_threw", reason: "kaboom" },
    });
  });

  test("rejects an execute request carrying an unknown or foreign workspace id", async () => {
    // The workspace id must resolve to a workspace in this route's project; a missing or
    // cross-project id is refused so a caller cannot mount another project's worktree.
    const response = await app.request(`/v1/projects/${projectId}/extensions/commands/lab.counter.read/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws_from_another_project" }),
    });

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("workspace_not_found");
  });

  test("protects nested command execution from recursion", async () => {
    const response = await app.request(`/v1/projects/${projectId}/extensions/commands/lab.loop/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).toContain("nested_depth_exceeded");
  });
});

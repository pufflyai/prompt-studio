import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";
import type { EventBus } from "../../sync/event-bus";
import type { TicketsRouteDeps } from "../deps";

export type TicketsTestContext = {
  app: OpenAPIHono<AppBindings>;
  deps: TicketsRouteDeps;
  eventBus: EventBus;
  projectId: string;
  tempRoot: string;
  createGitRepo: (name: string) => string;
  cleanup: () => void;
};

export const createTicketsTestContext = async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-tickets-test-"));
  const previousAgentsEnv = process.env.PSTDIO_AGENTS;
  const previousDefaultExtensionsEnv = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  const previousHomeEnv = process.env.HOME;
  const previousLogTargetsEnv = process.env.PSTDIO_LOG_TARGETS;
  const previousPstdioHomeEnv = process.env.PSTDIO_HOME;

  process.env.PSTDIO_AGENTS = "fake";
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_LOG_TARGETS = "stdout";
  const testHome = join(tempRoot, "home");
  mkdirSync(testHome, { recursive: true });
  process.env.HOME = testHome;
  process.env.PSTDIO_HOME = join(testHome, ".pstdio");

  const { app, eventBus, deps } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-project" }),
  });
  const project = await projectRes.json();

  const createGitRepo = (name: string) => {
    const repoRoot = join(tempRoot, name);
    mkdirSync(repoRoot, { recursive: true });
    execSync("git init", { cwd: repoRoot, stdio: "pipe" });
    execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
    execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
    writeFileSync(join(repoRoot, "README.md"), `${name}\n`);
    execSync("git add README.md", { cwd: repoRoot, stdio: "pipe" });
    execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
    return repoRoot;
  };

  const cleanup = () => {
    if (previousAgentsEnv === undefined) {
      delete process.env.PSTDIO_AGENTS;
    } else {
      process.env.PSTDIO_AGENTS = previousAgentsEnv;
    }

    if (previousDefaultExtensionsEnv === undefined) {
      delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    } else {
      process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensionsEnv;
    }

    if (previousHomeEnv === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHomeEnv;
    }

    if (previousLogTargetsEnv === undefined) {
      delete process.env.PSTDIO_LOG_TARGETS;
    } else {
      process.env.PSTDIO_LOG_TARGETS = previousLogTargetsEnv;
    }

    if (previousPstdioHomeEnv === undefined) {
      delete process.env.PSTDIO_HOME;
    } else {
      process.env.PSTDIO_HOME = previousPstdioHomeEnv;
    }

    rmSync(tempRoot, { recursive: true, force: true });
  };

  return {
    app,
    deps,
    eventBus,
    projectId: project.id as string,
    tempRoot,
    createGitRepo,
    cleanup,
  } satisfies TicketsTestContext;
};

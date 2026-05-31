import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let appHandle: Awaited<ReturnType<typeof createApp>>;
let tempRoot: string;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;
let previousLogTargets: string | undefined;

const writeExtensionFixture = (dir: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "default-fixture",
      version: "1.0.0",
      displayName: "Default Fixture",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(join(dir, "extension.ts"), `export default {};`);
};

const restoreExtensionEnv = (previous: { defaultExtensions: string | undefined; pstdioHome: string | undefined }) => {
  if (previous.pstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = previous.pstdioHome;
  }
  if (previous.defaultExtensions === undefined) {
    delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  } else {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaultExtensions;
  }
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-create-project-test-"));
  previousPstdioHome = process.env.PSTDIO_HOME;
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  previousLogTargets = process.env.PSTDIO_LOG_TARGETS;
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_LOG_TARGETS = "stdout";

  appHandle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });
  app = appHandle.app;
});

afterAll(async () => {
  await appHandle.close();
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
  if (previousLogTargets === undefined) {
    delete process.env.PSTDIO_LOG_TARGETS;
  } else {
    process.env.PSTDIO_LOG_TARGETS = previousLogTargets;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/projects", () => {
  test("creates a project and returns 201", async () => {
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Test Project", agents: ["opencode"] }),
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.name).toBe("Test Project");
    expect(body.id).toBeDefined();
    expect(body.selected_agents).toEqual(["opencode"]);
    expect(body.default_agent_id).toBeNull();
    expect(body.default_agent_model).toBeNull();
  });

  test("returns 400 when request body contains unknown keys", async () => {
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Strict Project", unknown_key: "value" }),
    });

    expect(res.status).toBe(400);
  });

  test("does not seed package-internal templates or skills", async () => {
    const createRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Empty Catalog Project" }),
    });
    expect(createRes.status).toBe(201);

    const project = (await createRes.json()) as { id: string };

    const templatesRes = await app.request(`/v1/projects/${project.id}/templates`);
    expect(templatesRes.status).toBe(200);
    expect(await templatesRes.json()).toEqual([]);

    const skillsRes = await app.request(`/v1/projects/${project.id}/skills`);
    expect(skillsRes.status).toBe(200);
    expect(await skillsRes.json()).toEqual([]);
  });

  test("rolls back the project when default extension setup fails", async () => {
    const isolatedRoot = mkdtempSync(join(tmpdir(), "pstdio-api-create-project-rollback-test-"));
    const dbPath = join(isolatedRoot, "db.sqlite");
    const projectName = "Rollback Project";
    const previous = {
      defaultExtensions: process.env.PSTDIO_DEFAULT_EXTENSIONS,
      pstdioHome: process.env.PSTDIO_HOME,
    };
    process.env.PSTDIO_HOME = join(isolatedRoot, "home");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([{ source: join(isolatedRoot, "missing-extension") }]);

    try {
      const handle = await createApp({
        dbPath,
        storagePath: join(isolatedRoot, "storage"),
        filesRoot: "",
      });

      try {
        const createRes = await handle.app.request("/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: projectName }),
        });

        expect(createRes.status).toBe(500);
      } finally {
        await handle.close();
      }

      const verification = await createApp({
        dbPath,
        storagePath: join(isolatedRoot, "verification-storage"),
        filesRoot: "",
      });

      try {
        const listRes = await verification.app.request("/v1/projects");
        expect(listRes.status).toBe(200);

        const projects = (await listRes.json()) as { name: string }[];
        expect(projects.some((project) => project.name === projectName)).toBe(false);
      } finally {
        await verification.close();
      }
    } finally {
      restoreExtensionEnv(previous);
      rmSync(isolatedRoot, { recursive: true, force: true });
    }
  });

  test("installs configured default extensions only for the first project", async () => {
    const isolatedRoot = mkdtempSync(join(tmpdir(), "pstdio-api-default-extension-test-"));
    const sourcePath = join(isolatedRoot, "default-extension");
    const homePath = join(isolatedRoot, "home");
    const previous = {
      defaultExtensions: process.env.PSTDIO_DEFAULT_EXTENSIONS,
      pstdioHome: process.env.PSTDIO_HOME,
    };
    writeExtensionFixture(sourcePath);

    process.env.PSTDIO_HOME = homePath;
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([
      { source: sourcePath, installName: "default-fixture", skipInstall: true, force: true },
    ]);

    try {
      const handle = await createApp({
        dbPath: ":memory:",
        storagePath: join(isolatedRoot, "storage"),
        filesRoot: "",
      });

      try {
        const firstRes = await handle.app.request("/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "First Extension Project" }),
        });
        expect(firstRes.status).toBe(201);
        const firstProject = (await firstRes.json()) as { id: string };

        const installedPath = join(homePath, "extensions", "default-fixture");
        expect(existsSync(join(installedPath, "extension.ts"))).toBe(true);
        const firstProjectExtensions = await handle.deps.extensionService.listProjectExtensionInstances(
          firstProject.id,
        );
        expect(firstProjectExtensions).toEqual([
          expect.objectContaining({
            instance: expect.objectContaining({ enabled: true }),
            installedSource: expect.objectContaining({ install_name: "default-fixture" }),
          }),
        ]);

        writeFileSync(join(installedPath, "user-edit.txt"), "preserve");

        const secondRes = await handle.app.request("/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Second Extension Project" }),
        });
        expect(secondRes.status).toBe(201);
        expect(existsSync(join(installedPath, "user-edit.txt"))).toBe(true);
      } finally {
        await handle.close();
      }
    } finally {
      restoreExtensionEnv(previous);
      rmSync(isolatedRoot, { recursive: true, force: true });
    }
  });
});

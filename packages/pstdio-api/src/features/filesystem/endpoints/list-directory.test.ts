import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-filesystem-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/filesystem/list", () => {
  test("lists entries and flags git repositories", async () => {
    const caseDir = mkdtempSync(join(tempRoot, "case-"));
    const repoDir = join(caseDir, "repo");
    const docsDir = join(caseDir, "docs");
    const filePath = join(caseDir, "notes.md");

    mkdirSync(join(repoDir, ".git"), { recursive: true });
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(filePath, "# notes");

    const res = await app.request(`/v1/filesystem/list?path=${encodeURIComponent(caseDir)}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      currentPath: string;
      entries: Array<{
        name: string;
        path: string;
        isDirectory: boolean;
        isGitRepo: boolean;
      }>;
    };

    expect(body.currentPath).toBe(caseDir);

    const repo = body.entries.find((entry) => entry.name === "repo");
    const docs = body.entries.find((entry) => entry.name === "docs");
    const notes = body.entries.find((entry) => entry.name === "notes.md");

    expect(repo).toEqual({
      name: "repo",
      path: repoDir,
      isDirectory: true,
      isGitRepo: true,
    });
    expect(docs).toEqual({
      name: "docs",
      path: docsDir,
      isDirectory: true,
      isGitRepo: false,
    });
    expect(notes).toEqual({
      name: "notes.md",
      path: filePath,
      isDirectory: false,
      isGitRepo: false,
    });
  });

  test("supports home path alias", async () => {
    const res = await app.request("/v1/filesystem/list?path=~");
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      currentPath: string;
      entries: Array<{ name: string }>;
    };

    expect(basename(body.currentPath).length).toBeGreaterThan(0);
    expect(Array.isArray(body.entries)).toBe(true);
  });

  test("returns 400 for file path", async () => {
    const caseDir = mkdtempSync(join(tempRoot, "case-file-"));
    const filePath = join(caseDir, "single-file.txt");
    writeFileSync(filePath, "content");

    const res = await app.request(`/v1/filesystem/list?path=${encodeURIComponent(filePath)}`);
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Path is not a directory");
  });
});

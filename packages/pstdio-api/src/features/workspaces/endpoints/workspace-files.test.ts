import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import {
  createWorkspaceFileHandler,
  createWorkspaceFileRoute,
  deleteWorkspaceFileHandler,
  deleteWorkspaceFileRoute,
  getWorkspaceFileHandler,
  getWorkspaceFileRoute,
  listWorkspaceFilesHandler,
  listWorkspaceFilesRoute,
  revealWorkspaceFileHandler,
  revealWorkspaceFileRoute,
  writeWorkspaceFileHandler,
  writeWorkspaceFileRoute,
} from "./workspace-files";

const MAX_FILE_BYTES = 1024 * 1024;

let app: OpenAPIHono<AppBindings>;
let root: string;
let repoRoot: string;
let outside: string;
const workspaces = new Map<string, { id: string; project_id: string; worktree_path: string | null }>();
const reposByProject = new Map<string, Array<{ path: string }>>();
const revealedEntries: Array<{ absolutePath: string; type: "file" | "directory" }> = [];

const deps = {
  workspaceService: {
    get: async (id: string) => workspaces.get(id) ?? null,
  },
  repoService: {
    listByProject: async (projectId: string) => reposByProject.get(projectId) ?? [],
  },
} as unknown as WorkspacesRouteDeps;

const requestPath = (workspaceId: string, path: string) =>
  `/workspaces/${workspaceId}/file?path=${encodeURIComponent(path)}`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "pstdio-workspace-files-"));
  repoRoot = mkdtempSync(join(tmpdir(), "pstdio-workspace-files-repo-"));
  outside = mkdtempSync(join(tmpdir(), "pstdio-workspace-files-outside-"));
  workspaces.clear();
  reposByProject.clear();
  revealedEntries.length = 0;
  workspaces.set("workspace-1", { id: "workspace-1", project_id: "project-1", worktree_path: root });
  workspaces.set("default", { id: "default", project_id: "project-1", worktree_path: null });
  workspaces.set("orphan", { id: "orphan", project_id: "project-without-repos", worktree_path: null });
  reposByProject.set("project-1", [{ path: repoRoot }]);
  app = new OpenAPIHono<AppBindings>();
  app.openapi(listWorkspaceFilesRoute, listWorkspaceFilesHandler(deps));
  app.openapi(getWorkspaceFileRoute, getWorkspaceFileHandler(deps));
  app.openapi(createWorkspaceFileRoute, createWorkspaceFileHandler(deps));
  app.openapi(writeWorkspaceFileRoute, writeWorkspaceFileHandler(deps));
  app.openapi(deleteWorkspaceFileRoute, deleteWorkspaceFileHandler(deps));
  app.openapi(
    revealWorkspaceFileRoute,
    revealWorkspaceFileHandler(deps, async (entry) => {
      revealedEntries.push(entry);
    }),
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(repoRoot, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe("GET /workspaces/:id/files", () => {
  test("lists direct children and searches files and directories without .git", async () => {
    mkdirSync(join(root, ".git"), { recursive: true });
    mkdirSync(join(root, "docs"), { recursive: true });
    mkdirSync(join(root, "match-dir"), { recursive: true });
    writeFileSync(join(root, ".git/match-secret"), "private");
    writeFileSync(join(root, "README.md"), "readme");
    writeFileSync(join(root, "docs/match-notes.md"), "notes");
    writeFileSync(join(root, "match-dir/file.txt"), "text");

    const listResponse = await app.request("/workspaces/workspace-1/files");
    expect(listResponse.status).toBe(200);
    const list = (await listResponse.json()) as {
      workspace_id: string;
      path: string;
      entries: Array<{ path: string; type: string }>;
      truncated: boolean;
    };
    expect(list).toMatchObject({ workspace_id: "workspace-1", path: "", truncated: false });
    expect(list.entries.map(({ path, type }) => ({ path, type }))).toEqual([
      { path: "docs", type: "directory" },
      { path: "match-dir", type: "directory" },
      { path: "README.md", type: "file" },
    ]);

    const searchResponse = await app.request("/workspaces/workspace-1/files?query=match&limit=2");
    expect(searchResponse.status).toBe(200);
    const search = (await searchResponse.json()) as { entries: Array<{ path: string }>; truncated: boolean };
    expect(search.entries.map((entry) => entry.path)).toEqual(["docs/match-notes.md", "match-dir"]);
    expect(search.truncated).toBe(true);
  });

  test("lists files from the linked repository for a default workspace", async () => {
    writeFileSync(join(repoRoot, "README.md"), "default workspace");

    const response = await app.request("/workspaces/default/files");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      workspace_id: "default",
      entries: [{ path: "README.md", type: "file" }],
    });
  });

  test("returns 404 for a workspace without a linked file root", async () => {
    expect((await app.request("/workspaces/orphan/files")).status).toBe(404);
    expect((await app.request("/workspaces/missing/files")).status).toBe(404);
  });
});

describe("GET and PUT /workspaces/:id/file", () => {
  test("reads and replaces an existing UTF-8 text file", async () => {
    writeFileSync(join(root, "notes.md"), "before");

    const readResponse = await app.request(requestPath("workspace-1", "notes.md"));
    expect(readResponse.status).toBe(200);
    expect(await readResponse.json()).toMatchObject({
      workspace_id: "workspace-1",
      path: "notes.md",
      file_name: "notes.md",
      mime_type: "text/markdown",
      encoding: "utf8",
      content: "before",
      editable: true,
    });

    const writeResponse = await app.request(requestPath("workspace-1", "notes.md"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "after" }),
    });
    expect(writeResponse.status).toBe(200);
    expect(readFileSync(join(root, "notes.md"), "utf8")).toBe("after");
  });

  test("reads and replaces a default workspace file in the linked repository", async () => {
    writeFileSync(join(repoRoot, "notes.md"), "before");

    const readResponse = await app.request(requestPath("default", "notes.md"));
    expect(readResponse.status).toBe(200);
    expect(await readResponse.json()).toMatchObject({
      workspace_id: "default",
      path: "notes.md",
      content: "before",
      editable: true,
    });

    const writeResponse = await app.request(requestPath("default", "notes.md"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "after" }),
    });
    expect(writeResponse.status).toBe(200);
    expect(readFileSync(join(repoRoot, "notes.md"), "utf8")).toBe("after");
  });

  test("returns a supported image as a read-only data URL", async () => {
    writeFileSync(join(root, "pixel.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const response = await app.request(requestPath("workspace-1", "pixel.png"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      mime_type: "image/png",
      encoding: "base64",
      data_url: "data:image/png;base64,iVBORw==",
      editable: false,
    });
  });

  test("rejects missing, binary, and oversized files without creating files", async () => {
    writeFileSync(join(root, "binary.bin"), Buffer.from([0, 1, 2]));
    writeFileSync(join(root, "large.txt"), "x".repeat(MAX_FILE_BYTES + 1));

    expect((await app.request(requestPath("workspace-1", "missing.txt"))).status).toBe(404);
    expect((await app.request(requestPath("workspace-1", "binary.bin"))).status).toBe(415);
    expect((await app.request(requestPath("workspace-1", "large.txt"))).status).toBe(413);

    const createResponse = await app.request(requestPath("workspace-1", "missing.txt"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "new" }),
    });
    expect(createResponse.status).toBe(404);
  });

  test("rejects unsafe paths and symlink escapes", async () => {
    writeFileSync(join(outside, "secret.txt"), "secret");
    symlinkSync(outside, join(root, "escape"), "dir");
    const unsafePaths = ["../secret.txt", "/etc/passwd", "C:/secret.txt", "nested\\secret.txt", "escape/secret.txt"];

    for (const path of unsafePaths) {
      expect((await app.request(requestPath("workspace-1", path))).status).toBe(400);
    }
  });
});

describe("POST and DELETE /workspaces/:id/file", () => {
  test("creates an empty text file and deletes it", async () => {
    mkdirSync(join(root, "docs"));
    const path = requestPath("workspace-1", "docs/new.md");

    const createResponse = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "" }),
    });
    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toMatchObject({
      workspace_id: "workspace-1",
      path: "docs/new.md",
      encoding: "utf8",
      content: "",
      editable: true,
    });
    expect(readFileSync(join(root, "docs/new.md"), "utf8")).toBe("");

    const deleteResponse = await app.request(path, { method: "DELETE" });
    expect(deleteResponse.status).toBe(204);
    expect(() => readFileSync(join(root, "docs/new.md"), "utf8")).toThrow();
  });

  test("rejects duplicate, missing-parent, directory, and unsafe targets", async () => {
    writeFileSync(join(root, "existing.md"), "keep");
    mkdirSync(join(root, "docs"));

    const duplicate = await app.request(requestPath("workspace-1", "existing.md"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "replace" }),
    });
    expect(duplicate.status).toBe(409);
    expect(readFileSync(join(root, "existing.md"), "utf8")).toBe("keep");

    const missingParent = await app.request(requestPath("workspace-1", "missing/new.md"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "new" }),
    });
    expect(missingParent.status).toBe(404);
    expect((await app.request(requestPath("workspace-1", "docs"), { method: "DELETE" })).status).toBe(415);
    expect((await app.request(requestPath("workspace-1", "../outside.md"), { method: "DELETE" })).status).toBe(400);
  });
});

describe("POST /workspaces/:id/reveal", () => {
  test("resolves files and directories inside the workspace before revealing them", async () => {
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs/readme.md"), "readme");

    const directoryResponse = await app.request("/workspaces/workspace-1/reveal?path=docs", { method: "POST" });
    const fileResponse = await app.request("/workspaces/workspace-1/reveal?path=docs%2Freadme.md", { method: "POST" });

    expect(directoryResponse.status).toBe(204);
    expect(fileResponse.status).toBe(204);
    expect(revealedEntries).toEqual([
      { absolutePath: realpathSync(join(root, "docs")), type: "directory" },
      { absolutePath: realpathSync(join(root, "docs/readme.md")), type: "file" },
    ]);
  });

  test("rejects missing and unsafe entries before invoking the file manager", async () => {
    expect((await app.request("/workspaces/workspace-1/reveal?path=missing.md", { method: "POST" })).status).toBe(404);
    expect((await app.request("/workspaces/workspace-1/reveal?path=..%2Fsecret", { method: "POST" })).status).toBe(400);
    expect(revealedEntries).toEqual([]);
  });
});

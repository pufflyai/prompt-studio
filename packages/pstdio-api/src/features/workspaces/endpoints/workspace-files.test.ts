import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import {
  getWorkspaceFileHandler,
  getWorkspaceFileRoute,
  listWorkspaceFilesHandler,
  listWorkspaceFilesRoute,
  writeWorkspaceFileHandler,
  writeWorkspaceFileRoute,
} from "./workspace-files";

const MAX_FILE_BYTES = 1024 * 1024;

let app: OpenAPIHono<AppBindings>;
let root: string;
let outside: string;
const workspaces = new Map<string, { id: string; worktree_path: string | null }>();

const deps = {
  workspaceService: {
    get: async (id: string) => workspaces.get(id) ?? null,
  },
} as unknown as WorkspacesRouteDeps;

const requestPath = (workspaceId: string, path: string) =>
  `/workspaces/${workspaceId}/file?path=${encodeURIComponent(path)}`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "pstdio-workspace-files-"));
  outside = mkdtempSync(join(tmpdir(), "pstdio-workspace-files-outside-"));
  workspaces.clear();
  workspaces.set("workspace-1", { id: "workspace-1", worktree_path: root });
  workspaces.set("default", { id: "default", worktree_path: null });
  app = new OpenAPIHono<AppBindings>();
  app.openapi(listWorkspaceFilesRoute, listWorkspaceFilesHandler(deps));
  app.openapi(getWorkspaceFileRoute, getWorkspaceFileHandler(deps));
  app.openapi(writeWorkspaceFileRoute, writeWorkspaceFileHandler(deps));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
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

  test("returns 404 for a workspace without a worktree", async () => {
    expect((await app.request("/workspaces/default/files")).status).toBe(404);
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

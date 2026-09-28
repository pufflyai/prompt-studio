import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";

type AppHandle = Awaited<ReturnType<typeof createTestApp>>;

let handle: AppHandle;
let tempRoot: string;
let originalDefaultExtensions: string | undefined;
let originalPstdioHome: string | undefined;

beforeAll(async () => {
  originalDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  originalPstdioHome = process.env.PSTDIO_HOME;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-add-local-extension-test-"));
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(tempRoot, "storage") });
});

afterAll(async () => {
  await handle.close();
  if (originalDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = originalDefaultExtensions;
  if (originalPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = originalPstdioHome;
  rmSync(tempRoot, { recursive: true, force: true });
});

const createProject = async (name: string) => {
  const input = folderProjectInput({ name });
  const response = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const project = (await response.json()) as { id: string };
  return { id: project.id, repoPath: realpathSync(input.initial_workspace.params.path) };
};

const packageJson = (name: string) =>
  JSON.stringify({
    name,
    version: "1.0.0",
    displayName: "Dropped Extension",
    publisher: "test",
    main: "./extension.ts",
    engines: { pstdio: EXTENSION_API_VERSION },
  });

const extensionFiles = (name: string) => ({
  "package.json": packageJson(name),
  "extension.ts": 'import "./src/title";\n\nexport default {};\n',
  "src/title.ts": 'export const title = "Dropped";\n',
});

const addFolder = (projectId: string, name: string, files: Record<string, string>) => {
  const body = new FormData();
  body.append("name", name);
  for (const [path, content] of Object.entries(files)) body.append("files", new File([content], path));
  return handle.app.request(`/v1/projects/${projectId}/extensions/local`, { method: "POST", body });
};

describe("POST /v1/projects/:projectId/extensions/local", () => {
  test("copies the folder into the project's extensions folder and enables it", async () => {
    const project = await createProject("Drop Project");

    const response = await addFolder(project.id, "dropped-extension", extensionFiles("dropped-extension"));

    expect(response.status).toBe(200);
    const target = join(project.repoPath, ".pstdio", "extensions", "dropped-extension");
    const body = await response.json();
    expect(body.extension).toMatchObject({
      displayName: "Dropped Extension",
      enabled: true,
      installName: "dropped-extension",
      scope: "repo",
      sourcePath: target,
      status: "loaded",
    });
    expect(readFileSync(join(target, "src", "title.ts"), "utf8")).toBe('export const title = "Dropped";\n');

    const list = await (await handle.app.request(`/v1/projects/${project.id}/extensions`)).json();
    expect(list.extensions.map((extension: { id: string }) => extension.id)).toContain(body.extension.id);
  });

  test("rejects file paths that leave the extension folder", async () => {
    const project = await createProject("Drop Traversal Project");
    const extensionsRoot = join(project.repoPath, ".pstdio", "extensions");

    for (const path of ["../escaped.ts", "src/../../escaped.ts", "/escaped.ts", "..\\escaped.ts", "C:/escaped.ts"]) {
      const response = await addFolder(project.id, "traversal", { ...extensionFiles("traversal"), [path]: "x" });

      expect(response.status).toBe(400);
      expect(existsSync(join(extensionsRoot, "traversal"))).toBe(false);
      expect(existsSync(join(extensionsRoot, "escaped.ts"))).toBe(false);
    }
  });

  test("rejects a folder without a package.json", async () => {
    const project = await createProject("Drop Missing Manifest Project");
    const { "package.json": _manifest, ...files } = extensionFiles("no-manifest");

    const response = await addFolder(project.id, "no-manifest", files);

    expect(response.status).toBe(400);
    expect(existsSync(join(project.repoPath, ".pstdio", "extensions", "no-manifest"))).toBe(false);
  });

  test("refuses to replace a folder that already exists", async () => {
    const project = await createProject("Drop Conflict Project");
    expect((await addFolder(project.id, "twice", extensionFiles("twice"))).status).toBe(200);

    const second = await addFolder(project.id, "twice", {
      ...extensionFiles("twice"),
      "src/title.ts": 'export const title = "Replaced";\n',
    });

    expect(second.status).toBe(409);
    const target = join(project.repoPath, ".pstdio", "extensions", "twice");
    expect(readFileSync(join(target, "src", "title.ts"), "utf8")).toBe('export const title = "Dropped";\n');
  });
});

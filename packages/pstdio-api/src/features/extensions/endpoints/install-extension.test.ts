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
  return { id: project.id, repoPath: realpathSync.native(input.initial_workspace.params.path) };
};

const packageJson = (name: string) =>
  JSON.stringify({
    name,
    version: "1.0.0",
    displayName: "Dropped Extension",
    publisher: "test",
    main: "./extension.ts",
    pstdio: { scope: "repo" },
    engines: { pstdio: `^${EXTENSION_API_VERSION}` },
  });

const extensionFiles = (name: string) => ({
  "package.json": packageJson(name),
  "extension.ts": 'import "./src/title";\n\nexport default {};\n',
  "src/title.ts": 'export const title = "Dropped";\n',
});

const addFolder = (
  projectId: string,
  name: string,
  files: Record<string, string>,
  options: Record<string, string> = {},
) => {
  const body = new FormData();
  body.append("kind", "upload");
  body.append("installName", name);
  body.append("folderName", name);
  body.append("skipInstall", "true");
  for (const [key, value] of Object.entries(options)) body.set(key, value);
  for (const [path, content] of Object.entries(files)) body.append("files", new File([content], path));
  return handle.app.request(`/v1/projects/${projectId}/extensions/install`, { method: "POST", body });
};

describe("POST /v1/projects/:projectId/extensions/install", () => {
  test("copies the folder into the project's extensions folder and enables it", async () => {
    const project = await createProject("Drop Project");

    const response = await addFolder(project.id, "dropped-extension", extensionFiles("dropped-extension"));

    expect(response.status).toBe(201);
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

  test("rejects an invalid extension with the validation error it failed on", async () => {
    const project = await createProject("Drop Invalid Project");

    const response = await addFolder(project.id, "invalid-extension", {
      ...extensionFiles("invalid-extension"),
      "extension.ts": "export default { label: 'Dropped' };\n",
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe(
      'Extension "test.invalid-extension" declares unknown contribution "label"',
    );
    expect(existsSync(join(project.repoPath, ".pstdio", "extensions", "invalid-extension"))).toBe(false);
  });

  test("rejects an extension built for another API version with the advice to fix it", async () => {
    const project = await createProject("Drop Incompatible Project");
    const manifest = { ...JSON.parse(packageJson("old-api")), engines: { pstdio: "^0.0.9" } };

    const response = await addFolder(project.id, "old-api", {
      ...extensionFiles("old-api"),
      "package.json": JSON.stringify(manifest),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain(`add "^${EXTENSION_API_VERSION}" to engines.pstdio`);
  });

  test("refuses to replace a folder that already exists", async () => {
    const project = await createProject("Drop Conflict Project");
    expect((await addFolder(project.id, "twice", extensionFiles("twice"))).status).toBe(201);

    const second = await addFolder(project.id, "twice", {
      ...extensionFiles("twice"),
      "src/title.ts": 'export const title = "Replaced";\n',
    });

    expect(second.status).toBe(409);
    const target = join(project.repoPath, ".pstdio", "extensions", "twice");
    expect(readFileSync(join(target, "src", "title.ts"), "utf8")).toBe('export const title = "Dropped";\n');
  });
  test("keeps uploaded local dependencies after the scratch folder is removed", async () => {
    const project = await createProject("Upload dependencies");
    const manifest = JSON.parse(packageJson("upload-deps"));
    manifest.dependencies = { demo: "file:./vendor/demo" };
    const files = {
      ...extensionFiles("upload-deps"),
      "extension.ts":
        'import title from "demo"; export default { commands: [{ id: "hello", ref: {kind:"command",id:"hello"}, title, run() {return title;} }] };',
      "package.json": JSON.stringify(manifest),
      "vendor/demo/package.json": JSON.stringify({ name: "demo", version: "1.0.0", main: "index.ts" }),
      "vendor/demo/index.ts": 'export default "Dependency";',
    };
    const response = await addFolder(project.id, "upload-deps", files, { development: "true", skipInstall: "false" });
    expect(response.status).toBe(201);
    const target = join(project.repoPath, ".pstdio/extensions/upload-deps");
    expect(readFileSync(join(target, "node_modules/demo/index.ts"), "utf8")).toContain("Dependency");
    const refreshed = await addFolder(project.id, "upload-deps", files, { force: "true", skipInstall: "true" });
    expect(refreshed.status).toBe(201);
    const commands = await (await handle.app.request(`/v1/projects/${project.id}/extensions/commands`)).json();
    expect(commands.commands.some((command: { title: string }) => command.title === "Dependency")).toBe(true);
  });

  test("refuses install names that can replace an installed root", async () => {
    const project = await createProject("Invalid install name");
    const response = await addFolder(project.id, "invalid-name", extensionFiles("invalid-name"), {
      installName: ".",
      force: "true",
    });
    expect(response.status).toBe(400);
  });

  test("uses the manifest scope and host home for user installs", async () => {
    const project = await createProject("Host-owned upload");
    const manifest = JSON.parse(packageJson("user-tool"));
    delete manifest.pstdio;
    const response = await addFolder(
      project.id,
      "user-tool",
      {
        ...extensionFiles("user-tool"),
        "package.json": JSON.stringify(manifest),
        ".git/config": "[core]\n",
      },
      { installName: "custom-user-tool" },
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    const target = join(tempRoot, "pstdio-home/extensions/custom-user-tool");
    expect(body.source.targetPath).toBe(target);
    expect(body.extension).toMatchObject({ enabled: true, scope: "global", sourcePath: target });
    expect(existsSync(join(project.repoPath, ".pstdio/extensions/custom-user-tool"))).toBe(false);
    expect(readFileSync(join(target, ".git/config"), "utf8")).toBe("[core]\n");
    const diagnostics = await (
      await handle.app.request(`/v1/projects/${project.id}/extensions/diagnostics?scope=user`)
    ).json();
    expect(diagnostics.roots).toHaveLength(1);
    expect(diagnostics.roots[0].path).toBe(join(tempRoot, "pstdio-home/extensions"));
    expect(
      diagnostics.roots[0].check.extensions.some((entry: { id: string }) => entry.id === body.source.metadata.id),
    ).toBe(true);
  });

  test("replaces only with force and preserves the installed source on invalid replacement", async () => {
    const project = await createProject("Atomic replacement");
    expect((await addFolder(project.id, "replace-tool", extensionFiles("replace-tool"))).status).toBe(201);
    const target = join(project.repoPath, ".pstdio/extensions/replace-tool/src/title.ts");
    const conflict = await addFolder(project.id, "replace-tool", extensionFiles("replace-tool"));
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).source.targetPath).toBe(join(project.repoPath, ".pstdio/extensions/replace-tool"));
    const invalid = await addFolder(
      project.id,
      "replace-tool",
      {
        ...extensionFiles("replace-tool"),
        "extension.ts": "export default { broken: true };",
      },
      { force: "true" },
    );
    expect(invalid.status).toBe(422);
    expect(readFileSync(target, "utf8")).toContain("Dropped");
    const replacement = await addFolder(
      project.id,
      "replace-tool",
      {
        ...extensionFiles("replace-tool"),
        "src/title.ts": 'export const title = "New";',
      },
      { force: "true" },
    );
    expect(replacement.status).toBe(201);
    expect(readFileSync(target, "utf8")).toContain("New");
  });

  test("installs a source inside the host project while keeping sibling dependencies", async () => {
    const project = await createProject("Host project source");
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const source = join(project.repoPath, "tools/project-tool");
    mkdirSync(source, { recursive: true });
    for (const [path, content] of Object.entries(extensionFiles("project-tool"))) {
      mkdirSync(join(source, path, ".."), { recursive: true });
      writeFileSync(join(source, path), content);
    }
    const provider = join(project.repoPath, "tools/provider");
    mkdirSync(provider);
    writeFileSync(
      join(provider, "package.json"),
      JSON.stringify({ name: "provider", version: "1.0.0", main: "index.ts" }),
    );
    writeFileSync(join(provider, "index.ts"), 'export default "Sibling";');
    const manifest = JSON.parse(packageJson("project-tool"));
    manifest.dependencies = { provider: "file:../provider" };
    writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
    writeFileSync(
      join(source, "extension.ts"),
      'import title from "provider"; export default { commands: [{ id:"hello", ref:{kind:"command",id:"hello"}, title, run() {return title;} }] };',
    );
    const response = await handle.app.request(`/v1/projects/${project.id}/extensions/install`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: { kind: "project-folder", path: "tools/project-tool" } }),
    });
    expect(response.status).toBe(201);
    expect((await response.json()).source.targetPath).toBe(join(project.repoPath, ".pstdio/extensions/project-tool"));
    const refresh = await handle.app.request(`/v1/projects/${project.id}/extensions/install`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: { kind: "project-folder", path: "tools/project-tool" },
        force: true,
        skipInstall: true,
      }),
    });
    expect(refresh.status).toBe(201);
    rmSync(source, { recursive: true });
    const commands = await (await handle.app.request(`/v1/projects/${project.id}/extensions/commands`)).json();
    expect(commands.commands.some((command: { title: string }) => command.title === "Sibling")).toBe(true);
    const escaping = await handle.app.request(`/v1/projects/${project.id}/extensions/install`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: { kind: "project-folder", path: "../tool" } }),
    });
    expect(escaping.status).toBe(400);
  });
});

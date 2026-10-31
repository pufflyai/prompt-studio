import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createSharedArtifactMount } from "../../../services/shared-files/artifact-mount";
import { createTestApp } from "../../../test-utils/create-test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
const previousHome = process.env.PSTDIO_HOME;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "open-cloud-project-"));
  process.env.PSTDIO_HOME = join(root, "home");
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  await rm(root, { recursive: true, force: true });
});

const recoveredProject = async (gitRemote?: string) => {
  const project = await app.deps.projectService.create({ name: "Shared notes" });
  const workspace = await app.deps.workspaceService.ensureDefault({
    project_id: project.id,
    name: "Project folder",
  });
  await app.deps.projectInfoService.write(project.id, { name: project.name, gitRemote });
  return { project, workspace };
};
const open = (id: string) => app.app.request(`/v1/projects/${id}/open`, { method: "POST" });

test.each([
  undefined,
  "git@example.test:team/private.git",
])("opening a recovered project attaches one local folder without cloning (%s)", async (remote) => {
  const { project, workspace } = await recoveredProject(remote);
  const responses = await Promise.all([open(project.id), open(project.id)]);
  expect(responses.map((response) => response.status)).toEqual([200, 200]);
  const [first, second] = await Promise.all(responses.map((response) => response.json()));
  expect(first.id).toBe(workspace.id);
  expect(second.root_path).toBe(first.root_path);
  expect(first.root_path).toBeTruthy();
  expect(first.initializing).toBe(false);
  expect(first.setup_error).toBeNull();
  expect(JSON.parse(await readFile(join(first.root_path, ".pstdio/config.json"), "utf8"))).toMatchObject({
    project_id: project.id,
    workspace_id: workspace.id,
  });
  await writeFile(join(first.root_path, "local.txt"), "Keep my edits");
  expect((await (await open(project.id)).json()).root_path).toBe(first.root_path);
  expect(await readFile(join(first.root_path, "local.txt"), "utf8")).toBe("Keep my edits");
  const other = await recoveredProject();
  expect((await (await open(other.project.id)).json()).root_path).not.toBe(first.root_path);
});

test("opening an already bound project preserves its folder and workspace identity", async () => {
  const { project, workspace } = await recoveredProject();
  const path = join(root, "existing");
  await mkdir(path);
  const attached = await app.app.request(`/v1/projects/${project.id}/initial-workspace`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider_id: "pstdio.root", params: { path } }),
  });
  expect(attached.status).toBe(201);
  const response = await open(project.id);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ id: workspace.id, root_path: await realpath(path) });
});

test("opening restores downloaded notes and artifacts before returning a ready folder", async () => {
  const { project, workspace } = await recoveredProject();
  const source = join(root, "extension");
  await mkdir(source);
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "documents",
      publisher: "example",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  await writeFile(
    join(source, "extension.ts"),
    `export default {
    artifactMounts: [
      { id: "notes", ref: { kind: "artifact-mount", id: "notes" }, path: "notes", label: "Notes" },
      { id: "artifacts", ref: { kind: "artifact-mount", id: "artifacts" }, path: "artifacts", label: "Artifacts" }
    ]
  };`,
  );
  const enabled = await app.app.request(`/v1/projects/${project.id}/extensions/installed/documents/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Documents",
      extensionId: "example.documents",
      manifest: { id: "example.documents", name: "documents" },
      name: "documents",
      sourceKind: "local_path",
      sourcePath: source,
      sourceRef: null,
      version: "1.0.0",
    }),
  });
  expect(enabled.status).toBe(200);
  // Seed the durable journal as a download would, with a different filesystem copy.
  for (const [mountPath, path, content] of [
    ["notes", "note/content.md", "# Shared note"],
    ["artifacts", "page.html", "<h1>Shared artifact</h1>"],
  ]) {
    const mount = createSharedArtifactMount(app.deps, {
      projectId: project.id,
      extensionId: "example.documents",
      repoRoot: join(root, "other-device"),
      name: "documents",
      mountPath,
      mountPaths: ["notes", "artifacts"],
    });
    await mount.writeText(path!, content!);
  }
  const restored = join(
    process.env.PSTDIO_HOME!,
    "projects",
    `project-${project.id}`,
    ".pstdio/extension-storage/example.documents",
  );
  const premature: string[] = [];
  const unsubscribe = app.deps.eventBus.subscribe((event) => {
    if (event.table !== "workspaces") return;
    const row = event.data as {
      id?: string;
      root_path?: string;
      initializing?: boolean;
      setup_error?: string | null;
      provider_state?: string;
    };
    if (
      row.id === workspace.id &&
      row.root_path &&
      row.provider_state === "ready" &&
      row.initializing === false &&
      !row.setup_error &&
      !existsSync(join(restored, "notes/note/content.md"))
    )
      premature.push(row.id);
  });
  const response = await open(project.id);
  unsubscribe();
  expect(premature).toEqual([]);
  expect(response.status).toBe(200);
  const home = await response.json();
  const stored = join(home.root_path, ".pstdio/extension-storage/example.documents");
  expect(await readFile(join(stored, "notes/note/content.md"), "utf8")).toBe("# Shared note");
  expect(await readFile(join(stored, "artifacts/page.html"), "utf8")).toBe("<h1>Shared artifact</h1>");
});

test("a failed folder setup can be retried without replacing project identity", async () => {
  const { project, workspace } = await recoveredProject();
  const path = join(process.env.PSTDIO_HOME!, "projects", `project-${project.id}`);
  await mkdir(join(path, ".pstdio"), { recursive: true });
  await writeFile(join(path, ".pstdio/config.json"), JSON.stringify({ project_id: "another-project" }));
  const failed = await open(project.id);
  expect(failed.status).toBe(400);
  expect((await failed.json()).error).toContain("another Prompt Studio project");
  expect((await app.deps.workspaceService.getDefault(project.id))?.id).toBe(workspace.id);
  await rm(join(path, ".pstdio/config.json"));
  const retried = await open(project.id);
  expect(retried.status).toBe(200);
  expect(await retried.json()).toMatchObject({
    id: workspace.id,
    root_path: await realpath(path),
    setup_error: null,
    initializing: false,
  });
});

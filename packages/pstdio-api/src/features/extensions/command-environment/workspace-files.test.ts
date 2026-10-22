import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type WorkspaceCapabilities, workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import { createProjectsDBService, folderWorkspaceCapabilities } from "pstdio-db";
import { apiLogger } from "../../../lib/logger";
import { artifactFilesFixture } from "../../../services/shared-files/artifact-files.fixture";
import { createArtifactMountWriteLedger } from "../artifact-mount-watch/write-ledger";
import { createCommandEnvironment } from "./index";

let root: string;
let shared: Awaited<ReturnType<typeof artifactFilesFixture>>;
let workspace: {
  id: string;
  project_id: string;
  root_path: string | null;
  execution_kind: "local" | "remote";
  provider_state: string;
  initializing: boolean;
  setup_error: string | null;
  provider_capabilities_json: WorkspaceCapabilities;
};
beforeEach(async () => {
  shared = await artifactFilesFixture();
  await createProjectsDBService(shared.db).create({ id: "project-1", name: "Workspace files" });
  root = await mkdtemp(join(tmpdir(), "extension-workspace-files-"));
  workspace = {
    id: "workspace-1",
    project_id: "project-1",
    root_path: root,
    execution_kind: "local",
    provider_state: "ready",
    initializing: false,
    setup_error: null,
    provider_capabilities_json: { ...folderWorkspaceCapabilities },
  };
  for (const path of [
    "",
    ".pstdio/extension-storage/tools/.publishers/example",
    ".pstdio/extension-storage/tools/reports",
  ]) {
    await mkdir(join(root, path), { recursive: true });
    await writeFile(join(root, path, "notes.txt"), "keep");
  }
});
afterEach(async () => {
  await shared.close();
  await rm(root, { recursive: true, force: true });
});

const environment = (eventId?: string, home = () => workspace) =>
  createCommandEnvironment(
    {
      ...shared.deps,
      artifactMountWrites: createArtifactMountWriteLedger(),
      workspaceService: { get: async () => workspace, getDefault: async () => home() },
    } as never,
    [
      { instance: { id: "instance-1" }, installedSource: { extension_id: "example.tools", source_path: root } },
    ] as never,
    {
      project: { id: "project-1", name: "Project", shorthand: "P" },
      projectId: "project-1",
      extensionId: "example.tools",
      name: "tools",
      workspaceId: "workspace-1",
      workspaceDir: root,
      eventId,
      artifactMounts: [
        { extensionId: "example.tools", localId: "reports", name: "tools", relativePath: "reports" },
      ] as never,
    },
  );

const mounts = (env: ReturnType<typeof environment>) => [
  env.projectFiles!,
  env.workspaceFiles!,
  env.extensionFiles!,
  env.artifacts.mount("reports"),
];

test("legacy file lists retain the caller's paths after storage moves to the full ID", async () => {
  const env = environment();
  const prefix = ".pstdio/extension-storage/tools/reports";
  const files = await env.projectFiles!.list(`${prefix}/**`);
  expect(files.map((file) => file.path)).toEqual([`${prefix}/notes.txt`]);
  expect(await env.projectFiles!.readText(files[0]!.path)).toBe("keep");
});

test("read-only providers allow reads and reject every file mutation", async () => {
  workspace.provider_capabilities_json = { ...folderWorkspaceCapabilities, files: "read" };
  const env = environment();
  for (const mount of mounts(env)) {
    expect(await mount.readText("notes.txt")).toBe("keep");
    await expect(mount.writeText("notes.txt", "changed")).rejects.toThrow("write");
    await expect(mount.writeBytes("bytes.txt", new Uint8Array([1]))).rejects.toThrow("write");
    await expect(mount.delete("notes.txt")).rejects.toThrow("write");
    expect(await mount.readText("notes.txt")).toBe("keep");
  }
  await expect(env.workspaceFiles!.syncDir("generated", [{ path: "tool.txt", content: "changed" }])).rejects.toThrow(
    "write",
  );
  expect((await lstat(join(root, ".pstdio/extension-storage/tools"))).isSymbolicLink()).toBe(false);
  await expect(lstat(join(root, ".pstdio/extension-storage/example.tools"))).rejects.toThrow();
  await expect(lstat(join(root, ".pstdio/.gitignore"))).rejects.toThrow();
});

test("file capabilities are checked again after a mount has been used", async () => {
  const all = mounts(environment());
  for (const mount of all) expect(await mount.readText("notes.txt")).toBe("keep");
  workspace.provider_capabilities_json = { ...folderWorkspaceCapabilities, files: "none" };
  for (const mount of all) {
    await expect(mount.readText("notes.txt")).rejects.toThrow("read");
    await expect(mount.list()).rejects.toThrow("read");
    await expect(mount.writeText("notes.txt", "changed")).rejects.toThrow("write");
  }
});

test("only provisioning hooks can access their own initializing workspace", async () => {
  workspace.initializing = true;
  workspace.setup_error = "previous setup failed";
  for (const mount of mounts(environment())) await expect(mount.readText("notes.txt")).rejects.toThrow("ready");
  for (const mount of mounts(environment(workspaceEvents.provision.id))) {
    await mount.writeText("notes.txt", "retry");
    expect(await mount.readText("notes.txt")).toBe("retry");
  }
  expect(await readFile(join(root, "notes.txt"), "utf8")).toBe("retry");
});

test("provisioning one workspace cannot bypass another workspace's initialization", async () => {
  workspace.initializing = true;
  const home = { ...workspace, id: "workspace-home" };
  const env = environment(workspaceEvents.provision.id, () => home);
  await env.workspaceFiles!.writeText("notes.txt", "provisioning");
  await expect(env.projectFiles!.readText("notes.txt")).rejects.toThrow("ready");
  await expect(env.extensionFiles!.readText("notes.txt")).rejects.toThrow("ready");
  await expect(env.artifacts.mount("reports").readText("notes.txt")).rejects.toThrow("ready");
});

test("workspace targets reject failed, remote, and cross-project access", async () => {
  const env = environment();
  workspace.provider_state = "failed";
  for (const mount of mounts(env)) await expect(mount.readText("notes.txt")).rejects.toThrow("ready");
  workspace.provider_state = "ready";
  workspace.execution_kind = "remote";
  for (const mount of mounts(env)) await expect(mount.readText("notes.txt")).rejects.toThrow("local");
  workspace.execution_kind = "local";
  workspace.project_id = "another-project";
  for (const mount of mounts(env)) await expect(mount.readText("notes.txt")).rejects.toThrow("local file target");
});

test("workspace sync keeps a file it does not own and logs where it is", async () => {
  await mkdir(join(root, ".claude/skills/review"), { recursive: true });
  await writeFile(join(root, ".claude/skills/review/SKILL.md"), "Local");
  const warnSpy = spyOn(apiLogger, "warn").mockImplementation(() => {});

  try {
    await environment().workspaceFiles!.syncDir(".claude/skills", [{ path: "review/SKILL.md", content: "Extension" }]);

    expect(await readFile(join(root, ".claude/skills/review/SKILL.md"), "utf8")).toBe("Local");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "extension.workspace_sync.kept_file",
        extensionId: "example.tools",
        path: join(root, ".claude/skills/review/SKILL.md"),
        reason: "unmanaged",
      }),
      expect.any(String),
    );
  } finally {
    warnSpy.mockRestore();
  }
});

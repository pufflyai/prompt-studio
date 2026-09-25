import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommandEnvironment } from "./index";

let root: string;
let workspace: {
  id: string;
  project_id: string;
  root_path: string | null;
  execution_kind: string;
  provider_state: string;
  initializing: boolean;
  setup_error: string | null;
};
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "workspace-process-")));
  workspace = {
    id: "home",
    project_id: "project",
    root_path: root,
    execution_kind: "local",
    provider_state: "ready",
    initializing: false,
    setup_error: null,
  };
});
afterEach(() => rm(root, { recursive: true, force: true }));
const environment = () =>
  createCommandEnvironment(
    { workspaceService: { get: async () => workspace, getDefault: async () => workspace } } as never,
    [{ instance: { id: "instance" }, installedSource: { extension_id: "example.tools", source_path: root } }] as never,
    {
      project: { id: "project", name: "Project", shorthand: "P" },
      projectId: "project",
      extensionId: "example.tools",
      name: "tools",
      workspaceId: "home",
      workspaceDir: root,
    },
  );
const command = ["bun", "-e", "console.log(process.cwd())"];

test("extension processes use the workspace folder and may choose a directory explicitly", async () => {
  const api = environment().process;
  expect((await api.run({ command })).stdout.trim()).toBe(root);
  const explicitDirectory = (await api.run({ command, cwd: tmpdir() })).stdout.trim();
  expect(await realpath(explicitDirectory)).toBe(await realpath(tmpdir()));
});

test.each([
  "remote",
  "failed",
  "provisioning",
  "foreign",
])("extension processes reject %s targets even with an explicit local cwd", async (state) => {
  const api = environment().process;
  if (state === "remote") {
    workspace.execution_kind = "remote";
    workspace.root_path = null;
  }
  if (state === "failed") workspace.setup_error = "Setup failed";
  if (state === "provisioning") workspace.initializing = true;
  if (state === "foreign") workspace.project_id = "other";
  await expect(api.run({ command, cwd: root })).rejects.toThrow("local process target");
  await expect(api.spawnDetached({ command, cwd: root })).rejects.toThrow("local process target");
});

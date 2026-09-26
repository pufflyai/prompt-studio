import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createWorkspaceContextFixture } from "../workspace-context.test-fixture";
import { createCommandEnvironment } from "./index";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
});
afterEach(async () => {
  await fixture.cleanup();
});
const environment = (eventId?: string) =>
  createCommandEnvironment(fixture.deps, [fixture.source] as never, {
    project: { id: "project-1", name: "Project", shorthand: "P" },
    projectId: "project-1",
    extensionId: "example.context",
    name: "context",
    workspaceId: fixture.workspace.id,
    workspaceDir: fixture.root,
    eventId,
  });

test("selected workspace files recheck read and write capabilities, including sync", async () => {
  const env = environment();
  Object.assign(fixture.workspace.provider_capabilities_json, { files: "read" });
  expect(await env.workspaceFiles!.readText("notes.txt")).toBe("selected folder");
  await expect(env.workspaceFiles!.writeText("notes.txt", "changed")).rejects.toThrow("write");
  await expect(env.workspaceFiles!.syncDir("tools", [])).rejects.toThrow("write");
  Object.assign(fixture.workspace.provider_capabilities_json, { files: "none" });
  await expect(env.workspaceFiles!.readText("notes.txt")).rejects.toThrow("read");
  expect(await readFile(join(fixture.root, "notes.txt"), "utf8")).toBe("selected folder");
});

test("selected workspace files never retain a local target after becoming remote or unready", async () => {
  const env = environment();
  Object.assign(fixture.workspace, { execution_kind: "remote" });
  await expect(env.workspaceFiles!.readText("notes.txt")).rejects.toThrow("local");
  Object.assign(fixture.workspace, { execution_kind: "local", setup_error: "failed" });
  await expect(env.workspaceFiles!.readText("notes.txt")).rejects.toThrow("ready");
});

test("provisioning can repair project and working files only when they refer to its own workspace", async () => {
  Object.assign(fixture.workspace, { initializing: true, setup_error: "retrying" });
  const env = environment("workspace.provision");
  await env.projectFiles!.writeText("project.txt", "repaired");
  await env.workspaceFiles!.writeText("working.txt", "repaired");
  fixture.deps.workspaceService.getDefault = async () => ({ ...fixture.workspace, id: "other-home" }) as never;
  await expect(env.projectFiles!.writeText("project.txt", "changed")).rejects.toThrow("ready");
  await expect(environment().workspaceFiles!.writeText("working.txt", "changed")).rejects.toThrow("ready");
});

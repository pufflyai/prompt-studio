import { expect, test } from "bun:test";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { createCommandEnvironment } from "../extensions/command-environment";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../harnesses/test-harness-registry";

test("HTTP and extension sessions share the exact folder and pass attachments to the harness", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "folder-sessions-")));
  const starts: Array<{ cwd?: string; workspaceId?: string; attachments?: unknown[] }> = [];
  const harnessRegistry = createTestHarnessRegistry([
    createTestHarnessRecord("folder-agent", {
      provider: {
        start: (_ctx, input) => {
          starts.push({ cwd: input.cwd, workspaceId: input.workspace?.workspaceId, attachments: input.attachments });
          return { done: Promise.resolve({ status: "completed" }), stop: () => {} };
        },
      },
    }),
  ]);
  const handle = await createTestApp({ harnessRegistry });
  try {
    await writeFile(join(root, "notes.md"), "user notes");
    const response = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initial_workspace: { provider_id: "pstdio.root", params: { path: root } } }),
    });
    expect(response.status).toBe(201);
    const project = await response.json();
    const home = await handle.deps.workspaceService.getDefault(project.id);
    const http = await handle.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, title: "First", prompt: "read notes" }),
    });
    expect(http.status).toBe(201);
    const first = await http.json();
    const file = await handle.deps.fileService.upload({
      project_id: project.id,
      file_name: "context.txt",
      file_kind: "session_attachment",
      data: Buffer.from("context"),
    });
    const env = createCommandEnvironment(
      handle.deps,
      [
        {
          instance: { id: "instance", namespace: "lab" },
          installedSource: { id: "source", extension_id: "test.lab", source_path: root },
        },
      ] as never,
      { project, projectId: project.id, extensionId: "test.lab", name: "lab" },
    );
    const second = await env.sessions.create({
      title: "Second",
      prompt: "continue",
      attachments: [{ file_id: file.id }],
    });
    for (let i = 0; starts.length < 2 && i < 50; i++) await Bun.sleep(10);
    expect(starts).toHaveLength(2);
    expect(starts.map(({ cwd, workspaceId }) => ({ cwd, workspaceId }))).toEqual([
      { cwd: root, workspaceId: home!.id },
      { cwd: root, workspaceId: home!.id },
    ]);
    expect(starts[1]!.attachments).toEqual([expect.objectContaining({ fileId: file.id })]);
    expect((await handle.deps.workspaceSessionService.getWorkspaceBySessionId(first.id))?.id).toBe(home!.id);
    expect((await handle.deps.workspaceSessionService.getWorkspaceBySessionId(second.id))?.id).toBe(home!.id);
    expect(await handle.deps.workspaceService.list(project.id)).toHaveLength(1);
    for (const id of [first.id, second.id]) {
      for (let i = 0; i < 50 && (await handle.deps.sessionService.get(id))?.status !== "completed"; i++)
        await Bun.sleep(10);
      expect((await handle.deps.sessionService.get(id))?.status).toBe("completed");
    }
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

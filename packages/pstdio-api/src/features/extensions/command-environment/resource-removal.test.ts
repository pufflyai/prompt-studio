import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createResourcesApi } from "./resources";

test("resource removal publishes a scoped fact to every subscriber and rejects foreign ownership", async () => {
  const root = await mkdtemp(join(tmpdir(), "resource-removal-"));
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Removal" });
    const sourcePath = join(root, "notes");
    await mkdir(sourcePath);
    const manifest = {
      name: "notes",
      publisher: "example",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    };
    await Bun.write(join(sourcePath, "package.json"), JSON.stringify(manifest));
    await Bun.write(
      join(sourcePath, "extension.ts"),
      `export default {
      resourceKinds: [{ id: "note", ref: { kind: "resource-kind", id: "note" } }],
      commands: [
        { id: "delete", ref: { kind: "command", id: "delete" }, title: "Delete", cli: true,
          async run(ctx) { await ctx.resources.removed({ type: "note", id: "committed" }); throw new Error("later step failed"); } },
        { id: "outer", ref: { kind: "command", id: "outer" }, title: "Outer", cli: true,
          async run(ctx) { await ctx.commands.execute({ kind: "command", id: "delete" }, { params: {} }); throw new Error("outer failed"); } }
      ]
    };`,
    );
    await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath,
      sourceKind: "local_path",
      name: "notes",
      installName: "notes",
      extensionId: "example.notes",
      displayName: "Notes",
      manifest,
    });
    const resources = createResourcesApi(app.deps, { projectId: project.id, extensionId: "example.notes" });
    const received: unknown[][] = [[], []];
    const stops = received.map((events) =>
      app.deps.eventBus.subscribe((event) => {
        if (event.table === "resource_events") events.push(event.data);
      }),
    );
    await resources.removed({ type: "note", id: "one" });
    expect(received[0]).toEqual([
      expect.objectContaining({
        resource: {
          type: "note",
          id: "one",
          extensionId: "example.notes",
          projectId: project.id,
        },
      }),
    ]);
    expect(received[1]).toEqual(received[0]);
    await expect(resources.removed({ type: "ticket", id: "one" })).rejects.toThrow("not owned");
    await expect(resources.removed({ type: "note", id: "one", projectId: "other" })).rejects.toThrow("project");
    await expect(resources.removed({ type: "note", id: "one", extensionId: "other.extension" })).rejects.toThrow(
      "extension",
    );
    expect(received[0]).toHaveLength(1);
    for (const origin of ["cli", "dashboard"] as const) {
      const response = await app.app.request(
        `/v1/projects/${project.id}/extensions/commands/example.notes.command.outer/execute`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: origin }),
        },
      );
      expect(await response.json()).toMatchObject({ outcome: { status: "error" } });
    }
    expect(received[0]).toHaveLength(3);
    expect(received[1]).toEqual(received[0]);
    expect(received[0]![2]).toMatchObject({ resource: { id: "committed" } });
    for (const stop of stops) stop();
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createSessionsApi } from "./sessions";
import { createWorkspacesApi } from "./workspaces";

let close: (() => Promise<void>) | undefined;
afterEach(async () => close?.());

const setup = async () => {
  const app = await createTestApp();
  const root = mkdtempSync(join(tmpdir(), "legacy-links-"));
  close = async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  };
  const project = await app.deps.projectService.create({ name: "Anchors" });
  const other = await app.deps.projectService.create({ name: "Other" });
  for (const [extensionId, kind] of [
    ["pstdio.pstdio-planner", "ticket"],
    ["example.documents", "document"],
  ]) {
    const path = join(root, extensionId!);
    mkdirSync(path);
    const manifest = {
      name: extensionId!.split(".").at(-1),
      publisher: extensionId!.split(".")[0],
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: "^" + EXTENSION_API_VERSION },
    };
    writeFileSync(join(path, "package.json"), JSON.stringify(manifest));
    writeFileSync(
      join(path, "extension.ts"),
      "export default " + JSON.stringify({ resourceKinds: [{ id: kind, ref: { kind: "resource-kind", id: kind } }] }),
    );
    await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      extensionId: extensionId!,
      sourcePath: path,
      sourceKind: "local_path",
      name: manifest.name!,
      installName: manifest.name!,
      displayName: manifest.name!,
      manifest,
    });
  }
  const { workspaceService, sessionService, eventBus } = app.deps;
  const deps = app.deps;
  return {
    project,
    other,
    eventBus,
    workspaceService,
    sessionService,
    workspaces: createWorkspacesApi(deps, { projectId: project.id }, {} as never),
    sessions: createSessionsApi(deps, {
      projectId: project.id,
      project: { id: project.id, name: project.name, shorthand: "AN" },
    }),
  };
};

for (const target of ["workspace", "session"] as const) {
  test(`${target} anchors merge, replace and remove by resource identity within the project`, async () => {
    const env = await setup();
    const create = async (projectId: string) =>
      target === "workspace"
        ? env.workspaceService.createStandalone({ project_id: projectId })
        : env.sessionService.create({ project_id: projectId, title: "Anchors", agent: "test" });
    const api = target === "workspace" ? env.workspaces : env.sessions;
    const owned = await create(env.project.id);
    const foreign = await create(env.other.id);
    const first = { type: "ticket", id: "one", label: "First" };
    const second = { type: "ticket", id: "two" };
    const differentType = { type: "document", id: "one", extensionId: "example.documents" };
    await api.addAnchors(owned.id, [first, second, differentType]);
    const replacement = { ...first, label: "Updated" };
    await api.addAnchors(owned.id, [replacement, replacement]);
    expect((await api.get(owned.id))?.anchors_json).toEqual([differentType, replacement, second]);
    await api.removeAnchors(owned.id, [first]);
    await api.removeAnchors(owned.id, [first]);
    expect((await api.get(owned.id))?.anchors_json).toEqual([differentType, second]);
    await expect(api.addAnchors(foreign.id, [first])).rejects.toThrow("not found");
    await expect(api.removeAnchors(foreign.id, [first])).rejects.toThrow("not found");
    await expect(api.addAnchors("missing", [first])).rejects.toThrow("not found");
    await expect(api.removeAnchors("missing", [first])).rejects.toThrow("not found");
    expect(env.eventBus.getSince(0).at(-1)).toMatchObject({
      table: target === "workspace" ? "workspaces" : "sessions",
      op: "set",
      data: { id: owned.id, anchors_json: [differentType, second] },
    });
  });
}

for (const target of ["workspace", "session"] as const) {
  test(`${target} preserves concurrent anchor changes`, async () => {
    const env = await setup();
    const resource =
      target === "workspace"
        ? await env.workspaceService.createStandalone({ project_id: env.project.id })
        : await env.sessionService.create({ project_id: env.project.id, title: "Concurrent", agent: "test" });
    const api = target === "workspace" ? env.workspaces : env.sessions;
    const one = { type: "ticket", id: "one" };
    const two = { type: "ticket", id: "two" };
    const three = { type: "ticket", id: "three" };
    await Promise.all([api.addAnchors(resource.id, [one]), api.addAnchors(resource.id, [two])]);
    const linked = (await api.get(resource.id))?.anchors_json;
    expect(linked).toHaveLength(2);
    expect(linked).toEqual(expect.arrayContaining([one, two]));
    await Promise.all([api.removeAnchors(resource.id, [one]), api.addAnchors(resource.id, [three])]);
    expect((await api.get(resource.id))?.anchors_json).toEqual([three, two]);
    await Promise.all([api.removeAnchors(resource.id, [two]), api.removeAnchors(resource.id, [three])]);
    expect((await api.get(resource.id))?.anchors_json).toEqual([]);
  });
}

for (const target of ["workspace", "session"] as const) {
  test(`${target} skips unchanged anchor removals`, async () => {
    const env = await setup();
    const resource =
      target === "workspace"
        ? await env.workspaceService.createStandalone({ project_id: env.project.id })
        : await env.sessionService.create({ project_id: env.project.id, title: "Unchanged", agent: "test" });
    const api = target === "workspace" ? env.workspaces : env.sessions;
    const service = target === "workspace" ? env.workspaceService : env.sessionService;
    const anchor = { type: "ticket", id: "one" };
    await api.addAnchors(resource.id, [anchor]);
    const before = await service.get(resource.id);
    const sequence = env.eventBus.seq;
    await api.removeAnchors(resource.id, []);
    await api.removeAnchors(resource.id, [
      { type: "ticket", id: "missing" },
      { type: "document", id: "one", extensionId: "example.documents" },
    ]);
    expect(await service.get(resource.id)).toEqual(before);
    expect(env.eventBus.getSince(sequence)).toEqual([]);

    await Promise.all([api.removeAnchors(resource.id, [anchor]), api.removeAnchors(resource.id, [anchor])]);
    expect((await api.get(resource.id))?.anchors_json).toEqual([]);
    expect(env.eventBus.getSince(sequence).filter((event) => event.table === "resource_anchor_events")).toHaveLength(1);
    const removed = await service.get(resource.id);
    await api.removeAnchors(resource.id, [anchor]);
    expect(await service.get(resource.id)).toEqual(removed);
    expect(env.eventBus.getSince(sequence).filter((event) => event.table === "resource_anchor_events")).toHaveLength(1);
  });
}

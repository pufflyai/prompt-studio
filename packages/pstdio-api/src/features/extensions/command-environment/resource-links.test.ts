import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createResourcesApi } from "./resources";
import { createSessionsApi } from "./sessions";
import { createWorkspacesApi } from "./workspaces";

test("public resource links enforce owner policies atomically and publish committed changes only", async () => {
  const root = mkdtempSync(join(tmpdir(), "resource-links-"));
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Links" });
    const install = async (name: string, guarded = false) => {
      const path = join(root, name);
      mkdirSync(path);
      const manifest = {
        name,
        publisher: "example",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      };
      writeFileSync(join(path, "package.json"), JSON.stringify(manifest));
      writeFileSync(
        join(path, "extension.ts"),
        `export default {
        commands: [{id:"guard", title:"Guard", ref:{kind:"command",id:"guard"}, async run(ctx, params) {
          if (params.target.id === "mutate") await ctx.resources.addAnchors(params.source, [params.target]);
          if (params.target.id === "protected" || (params.operation === "remove" && params.target.id === "role-guard" && params.role === "result")) return {allowed:false, reason:"Protected link"};
          return {allowed:true};
        }}],
        resourceKinds: [{id:"item", ref:{kind:"resource-kind",id:"item"}, ${guarded ? 'validateAnchors:{kind:"command",id:"guard"},' : ""}}]
      };`,
      );
      return app.deps.extensionService.enableInstalledSourceForProject({
        projectId: project.id,
        sourcePath: path,
        sourceKind: "local_path",
        name,
        installName: name,
        extensionId: `example.${name}`,
        displayName: name,
        manifest,
      });
    };
    await install("notes");
    const art = await install("art", true);
    const api = createResourcesApi(app.deps, { projectId: project.id, extensionId: "example.notes" });
    const source = { type: "item", id: "source" };
    const target = { type: "item", id: "missing-domain-record", extensionId: "example.art", role: "result" as const };
    await api.addAnchors(source, [target]);
    const count = () =>
      app.deps.eventBus.getSince(0).filter((event) => event.table === "resource_anchor_events").length;
    const workspace = await app.deps.workspaceService.createStandalone({ project_id: project.id });
    const session = await app.deps.sessionService.create({ project_id: project.id, title: "Legacy", agent: "test" });
    const legacyApis = [
      { id: workspace.id, api: createWorkspacesApi(app.deps, { projectId: project.id }, {} as never) },
      {
        id: session.id,
        api: createSessionsApi(app.deps, {
          projectId: project.id,
          project: { id: project.id, name: project.name, shorthand: "L" },
        }),
      },
    ];
    for (const legacy of legacyApis) {
      await expect(legacy.api.addAnchors(legacy.id, [{ ...target, id: "protected" }])).rejects.toThrow(
        "Protected link",
      );
      await legacy.api.addAnchors(legacy.id, [{ ...target, id: "role-guard" }]);
      await expect(legacy.api.removeAnchors(legacy.id, [{ ...target, id: "role-guard" }])).rejects.toThrow(
        "Protected link",
      );
    }
    const priorWorkspaces = await app.deps.workspaceService.list(project.id);
    const priorSessions = await app.deps.sessionService.list(project.id);
    await expect(
      app.deps.workspaceService.createStandalone({ project_id: project.id, anchors: [{ ...target, id: "protected" }] }),
    ).rejects.toThrow("Protected link");
    await expect(
      app.deps.sessionService.create({
        project_id: project.id,
        title: "Rejected",
        agent: "test",
        anchors: [{ ...target, id: "protected" }],
      }),
    ).rejects.toThrow("Protected link");
    expect(await app.deps.workspaceService.list(project.id)).toEqual(priorWorkspaces);
    expect(await app.deps.sessionService.list(project.id)).toEqual(priorSessions);
    const seq = count();
    await api.addAnchors(source, [target]);
    expect(count()).toBe(seq);
    const incoming = await api.listAnchors({ resource: target, direction: "incoming" });
    expect(incoming.items).toHaveLength(1);
    expect(incoming.items[0]?.source).toMatchObject({ projectId: project.id, extensionId: "example.notes" });
    await expect(
      api.addAnchors(source, [
        { ...target, id: "valid" },
        { ...target, id: "protected" },
      ]),
    ).rejects.toThrow("Protected link");
    expect((await api.listAnchors({ resource: source })).items).toHaveLength(1);
    await expect(api.addAnchors(source, [{ ...target, projectId: "other" }])).rejects.toThrow("another project");
    await expect(api.addAnchors(source, [{ ...target, id: "mutate" }])).rejects.toThrow("cannot mutate");
    const guardedTarget = { ...target, id: "role-guard" };
    await api.addAnchors(source, [guardedTarget]);
    await expect(api.removeAnchors(source, [guardedTarget])).rejects.toThrow("Protected link");
    await createResourcesApi(app.deps, { projectId: project.id, extensionId: "example.art" }).removed(guardedTarget);
    expect((await api.listAnchors({ resource: source })).items).toHaveLength(1);
    await app.deps.extensionInstancesService.update(art.instance.id, { enabled: false });
    app.deps.extensionRuntimeCatalog.invalidate({ projectId: project.id, reason: "enablement_changed" });
    await expect(api.removeAnchors(source, [target])).rejects.toThrow("disabled");
    for (const legacy of legacyApis) {
      await expect(legacy.api.addAnchors(legacy.id, [target])).rejects.toThrow("disabled");
      await expect(legacy.api.removeAnchors(legacy.id, [{ ...target, id: "role-guard" }])).rejects.toThrow("disabled");
    }
    expect((await api.listAnchors({ resource: source })).items).toHaveLength(1);
    await app.deps.extensionService.uninstallProjectExtension({
      projectId: project.id,
      instanceId: art.instance.id,
      deleteUserData: true,
    });
    await api.removeAnchors(source, [target]);
    const removedSeq = count();
    await api.removeAnchors(source, [target]);
    expect(count()).toBe(removedSeq);
    expect((await api.listAnchors({ resource: source })).items).toEqual([]);
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("workspace deletion publishes current incoming workspace and session projections", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Cleanup" });
    const target = await app.deps.workspaceService.createStandalone({ project_id: project.id });
    const anchor = { type: "workspace", id: target.id };
    const source = await app.deps.workspaceService.createStandalone({ project_id: project.id, anchors: [anchor] });
    const session = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Linked",
      agent: "test",
      anchors: [anchor],
    });
    const seq = app.deps.eventBus.seq;
    await app.deps.workspaceService.softDelete(target.id);
    const events = app.deps.eventBus.getSince(seq);
    for (const [table, id] of [
      ["workspaces", source.id],
      ["sessions", session.id],
    ]) {
      expect(events).toContainEqual(
        expect.objectContaining({ table, op: "set", data: expect.objectContaining({ id, anchors_json: [] }) }),
      );
    }
  } finally {
    await app.close();
  }
});

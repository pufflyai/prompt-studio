import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { expectRejection } from "../../../test-utils/expect-rejection";
import { createResourceLinksApi } from "./resource-links";
import { createResourcesApi } from "./resources";
import { createSessionsApi } from "./sessions";
import { createWorkspacesApi } from "./workspaces";

test("cancelling a pending related-resource read rejects even an empty result", async () => {
  const app = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let result: Promise<string> | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "Cancelled related resources" });
    const controller = new AbortController();
    const related = app.deps.resourceLinksService.related.bind(app.deps.resourceLinksService);
    app.deps.resourceLinksService.related = async (query) => {
      const page = await related(query);
      expect(page.items).toEqual([]);
      entered.resolve();
      await release.promise;
      return page;
    };
    const resources = createResourceLinksApi(app.deps, { projectId: project.id, signal: controller.signal });
    result = resources.queryRelated({ resources: [{ type: "project", id: project.id }] }).then(
      () => "resolved",
      (error: Error) => error.name,
    );
    await entered.promise;
    controller.abort();
    release.resolve();
    expect(await result).toBe("AbortError");
  } finally {
    release.resolve();
    await result;
    await app.close();
  }
});

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
      await expectRejection(legacy.api.addAnchors(legacy.id, [{ ...target, id: "protected" }])).toThrow(
        "Protected link",
      );
      await legacy.api.addAnchors(legacy.id, [{ ...target, id: "role-guard" }]);
      await expectRejection(legacy.api.removeAnchors(legacy.id, [{ ...target, id: "role-guard" }])).toThrow(
        "Protected link",
      );
    }
    const priorWorkspaces = await app.deps.workspaceService.list(project.id);
    const priorSessions = await app.deps.sessionService.list(project.id);
    await expectRejection(
      app.deps.workspaceService.createStandalone({ project_id: project.id, anchors: [{ ...target, id: "protected" }] }),
    ).toThrow("Protected link");
    await expectRejection(
      app.deps.sessionService.create({
        project_id: project.id,
        title: "Rejected",
        agent: "test",
        anchors: [{ ...target, id: "protected" }],
      }),
    ).toThrow("Protected link");
    expect(await app.deps.workspaceService.list(project.id)).toEqual(priorWorkspaces);
    expect(await app.deps.sessionService.list(project.id)).toEqual(priorSessions);
    const seq = count();
    await api.addAnchors(source, [target]);
    expect(count()).toBe(seq);
    const incoming = await api.listAnchors({ resource: target, direction: "incoming" });
    expect(incoming.items).toHaveLength(1);
    expect(incoming.items[0]?.source).toMatchObject({ projectId: project.id, extensionId: "example.notes" });
    await expectRejection(
      api.addAnchors(source, [
        { ...target, id: "valid" },
        { ...target, id: "protected" },
      ]),
    ).toThrow("Protected link");
    expect((await api.listAnchors({ resource: source })).items).toHaveLength(1);
    await expectRejection(api.addAnchors(source, [{ ...target, projectId: "other" }])).toThrow("another project");
    await expectRejection(api.addAnchors(source, [{ ...target, id: "mutate" }])).toThrow("cannot mutate");
    const guardedTarget = { ...target, id: "role-guard" };
    await api.addAnchors(source, [guardedTarget]);
    await expectRejection(api.removeAnchors(source, [guardedTarget])).toThrow("Protected link");
    await createResourcesApi(app.deps, { projectId: project.id, extensionId: "example.art" }).removed(guardedTarget);
    expect((await api.listAnchors({ resource: source })).items).toHaveLength(1);
    await app.deps.extensionService.setProjectExtensionEnabled(art.instance.id, false);
    await expectRejection(api.removeAnchors(source, [target])).toThrow("disabled");
    for (const legacy of legacyApis) {
      await expectRejection(legacy.api.addAnchors(legacy.id, [target])).toThrow("disabled");
      await expectRejection(legacy.api.removeAnchors(legacy.id, [{ ...target, id: "role-guard" }])).toThrow("disabled");
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

test("generic and legacy host links share source checks, timestamps and change events", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Host link rules" });
    const foreign = await app.deps.projectService.create({ name: "Other project" });
    const workspace = await app.deps.workspaceService.createStandalone({ project_id: project.id });
    const resources = createResourcesApi(app.deps, { projectId: project.id, extensionId: "pstdio" });
    const workspaces = createWorkspacesApi(app.deps, { projectId: project.id }, {} as never);
    const source = { type: "workspace", id: workspace.id };
    const target = { type: "project", id: project.id };
    const count = () =>
      app.deps.eventBus.getSince(0).filter((event) => event.table === "resource_anchor_events").length;
    const before = count();
    await expectRejection(resources.addAnchors({ ...source, id: "missing" }, [target])).toThrow("not found");
    await expectRejection(resources.addAnchors(source, [{ ...target, id: foreign.id }])).toThrow("another project");
    expect(count()).toBe(before);
    await resources.addAnchors(source, [target, target]);
    expect(count()).toBe(before + 1);
    const added = (await app.deps.workspaceService.get(workspace.id))!;
    expect(added.updated_at).not.toBe(workspace.updated_at);
    await workspaces.addAnchors(workspace.id, [target]);
    expect(count()).toBe(before + 1);
    expect((await app.deps.workspaceService.get(workspace.id))!.updated_at).toBe(added.updated_at);
    await workspaces.removeAnchors(workspace.id, [target]);
    expect(count()).toBe(before + 2);
    expect((await resources.listAnchors({ resource: source })).items).toEqual([]);
    await resources.removeAnchors(source, [target]);
    expect(count()).toBe(before + 2);
    const start = app.deps.eventBus.seq;
    const projectEvents = () => app.deps.eventBus.getSince(start).filter((event) => event.table === "projects");
    await resources.addAnchors(target, [source]);
    expect(projectEvents()).toHaveLength(1);
    expect(projectEvents()[0]!.data).toEqual(await app.deps.projectService.get(project.id));
    await resources.addAnchors(target, [source]);
    expect(projectEvents()).toHaveLength(1);
    await resources.removeAnchors(target, [source]);
    expect(projectEvents()).toHaveLength(2);
  } finally {
    await app.close();
  }
});

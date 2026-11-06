import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createResourcesApi } from "./resources";

test("resource batches use enabled owners, preserve identity, and resolve host workspaces", async () => {
  const root = mkdtempSync(join(tmpdir(), "resource-resolution-"));
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Resources" });
    const sourcePath = join(root, "notes");
    mkdirSync(sourcePath);
    const manifest = {
      name: "notes",
      publisher: "example",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    };
    writeFileSync(join(sourcePath, "package.json"), JSON.stringify(manifest));
    writeFileSync(
      join(sourcePath, "extension.ts"),
      `export default {
      commands: [{ id: "resolve", title: "Resolve", ref: {kind:"command",id:"resolve"}, async run(ctx, params) {
        await ctx.storage.collection("calls").put("last", {count:params.resources.length});
        return params.resources.filter(r => r.id !== "missing").map(r => ({
          resource: {...r, label:"Current " + r.id, icon:"file-text", metadata:{batchSize:params.resources.length}, ...(r.id === "spoof" ? {extensionId:"other.owner"} : {})},
          target: {kind:"page",page:{kind:"page",id:r.id === "no-destination" ? "missing" : "notes"},resource:r}
        }));
      }}],
      views: [{id:"notes",ref:{kind:"view",id:"notes"},title:"Notes",body:{kind:"controls",query:async()=>({fields:[],values:{}})}}],
      pages: [{id:"notes",ref:{kind:"page",id:"notes"},title:"Notes",path:"notes",slots:[],panels:{},parent:{extensionId:"pstdio",kind:"page",id:"start"},mode:{extensionId:"pstdio",kind:"mode",id:"project"},resource:{kinds:[{kind:"resource-kind",id:"note"},{kind:"resource-kind",id:"draft"}]},main:{kind:"view",view:{kind:"view",id:"notes"},cardinality:"one"}}],
      resourceKinds: ["note","draft"].map(id => ({id,ref:{kind:"resource-kind",id},resolveMany:{kind:"command",id:"resolve"}}))
    };`,
    );
    const installed = await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath,
      sourceKind: "local_path",
      name: "notes",
      installName: "notes",
      extensionId: "example.notes",
      displayName: "Notes",
      manifest,
    });
    const api = createResourcesApi(app.deps, { projectId: project.id, extensionId: "example.caller" });
    const ref = (id: string, type = "note") => ({
      id,
      type,
      extensionId: "example.notes",
      projectId: project.id,
      label: "Saved",
    });
    const workspace = await app.deps.workspaceService.createStandalone({
      project_id: project.id,
      name: "Current workspace",
    });
    await api.addAnchors(ref("one"), [ref("two", "draft")]);
    const linked = await api.queryAnchorsMany({ resources: [ref("one"), ref("two", "draft")], direction: "both" });
    expect(linked.items).toHaveLength(1);
    expect(linked.nextCursor).toBeNull();
    const debug = await app.deps.extensionRuntimeCatalog.get(project.id);
    expect(debug.runtime.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    const result = await api.resolveMany([
      ref("one"),
      ref("two", "draft"),
      ref("one"),
      ref("missing"),
      ref("spoof"),
      ref("no-destination"),
      { type: "workspace", id: workspace.id, extensionId: "pstdio" },
    ]);
    expect(result).toHaveLength(4);
    expect(result.find((r) => r.resource.id === "one")).toMatchObject({
      resource: { label: "Current one", icon: "file-text", extensionId: "example.notes", metadata: { batchSize: 5 } },
      target: { page: { extensionId: "example.notes", id: "notes" } },
    });
    expect(result.find((r) => r.resource.id === workspace.id)).toMatchObject({
      resource: { label: "Current workspace", extensionId: "pstdio" },
      target: { kind: "page", page: { id: "files", extensionId: "pstdio.pstdio-workspaces" } },
    });
    const worktree = await app.deps.workspaceService.createStandalone({
      project_id: project.id,
      provider_id: "pstdio.worktree",
    });
    const [worktreeLink] = await api.resolveMany([
      { type: "workspace", id: worktree.id, extensionId: "pstdio", metadata: { workspaceSupportsDiff: false } },
    ]);
    expect(worktreeLink).toMatchObject({
      resource: {
        metadata: { workspaceProviderState: "ready", workspaceSupportsDiff: true, workspaceType: "worktree" },
      },
      target: { page: { id: "workspace", extensionId: "pstdio.pstdio-workspaces" } },
    });
    expect(result.find((r) => r.resource.id === "no-destination")?.target).toBeUndefined();
    await expect(api.resolveMany([{ ...ref("one"), projectId: "another-project" }])).rejects.toThrow("another project");
    await expect(api.resolveMany(Array.from({ length: 101 }, () => ref("one")))).rejects.toThrow("100");
    await app.deps.extensionService.setProjectExtensionEnabled(installed.instance.id, false);
    expect(await api.resolveMany([ref("one")])).toEqual([]);
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});

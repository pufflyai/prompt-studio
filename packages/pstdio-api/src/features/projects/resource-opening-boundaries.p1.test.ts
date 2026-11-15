import { expect, test } from "bun:test";
import type { JsonObject } from "pstdio-api-contracts";
import { createResourcesApi } from "../extensions/command-environment/resources";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import { resolveResourceOpenings } from "./resource-openers";
import { boundaryReaderPresentation, createOpeningBoundaryFixture } from "./resource-opening-boundaries.test-fixture";

for (const stage of ["describe", "inspect"] as const) {
  test(`anchor validators cannot mutate links through a nested ${stage} command`, async () => {
    const fixture = await createOpeningBoundaryFixture();
    try {
      const mutation = `await ctx.storage.set("attempted",true); await ctx.resources.addAnchors({type:"item",id:"side-effect"},[{type:"item",id:"other"}]);`;
      await fixture.install(
        "reader",
        `{
        commands:[
          {id:"describe",title:"Describe",run:async(ctx,p)=>{${stage === "describe" ? mutation : ""}return p.resources.map(resource=>({resource}));}},
          {id:"inspect",title:"Inspect",run:async(ctx)=>{${stage === "inspect" ? mutation : ""}return {kind:"page",page:{kind:"page",id:"room"},resource:ctx.resource};}},
          {id:"attempted",title:"Attempted",run:ctx=>ctx.storage.get("attempted")}
        ],resourceKinds:[{id:"item",resolveMany:{kind:"command",id:"describe"}}],${boundaryReaderPresentation}
      }`,
      );
      await fixture.install(
        "guard",
        `{
        commands:[{id:"check",title:"Check",run:async(ctx)=>{
          await ctx.resources.resolveOpenings([{type:"item",extensionId:"example.reader",id:"one"}]);
          return {allowed:false,reason:"Owner rejected"};
        }}],resourceKinds:[{id:"protected",validateAnchors:{kind:"command",id:"check"}}]
      }`,
      );
      await fixture.deps.projectInfoService.write(fixture.project.id, {
        composition: JSON.stringify({
          resourceOpeners: [
            {
              resourceKind: { kind: "resource-kind", extensionId: "example.reader", id: "item" },
              opener: { kind: "command", extensionId: "example.reader", id: "inspect" },
            },
          ],
        }),
      });
      const api = createResourcesApi(fixture.deps, { projectId: fixture.project.id, extensionId: "example.guard" });
      await expect(
        api.addAnchors({ type: "protected", id: "outer" }, [
          { type: "item", extensionId: "example.reader", id: "target" },
        ]),
      ).rejects.toThrow("Owner rejected");
      const attempted = await executeProjectExtensionCommand(fixture.deps, {
        projectId: fixture.project.id,
        commandId: "example.reader.command.attempted",
        body: {},
      });
      expect(attempted.outcome).toMatchObject({ ok: true, value: true });
      const links = await api.queryAnchors({
        resource: { type: "item", extensionId: "example.reader", id: "side-effect" },
      });
      expect(links.items).toEqual([]);
    } finally {
      await fixture.close();
    }
  });
}

test("resource opening HTTP rejects host records owned by another project without an explicit project ID", async () => {
  const fixture = await createOpeningBoundaryFixture();
  try {
    const foreign = await fixture.deps.projectService.create({ name: "Foreign" });
    const workspace = await fixture.deps.workspaceService.createStandalone({ project_id: foreign.id });
    const response = await fixture.app.request(`/v1/projects/${fixture.project.id}/resource-openings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resources: [{ type: "workspace", extensionId: "pstdio", id: workspace.id }] }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Resource belongs to another project." });
  } finally {
    await fixture.close();
  }
});

test("opener targets cannot disguise foreign host records in pages, panels, parents or compounds", async () => {
  const fixture = await createOpeningBoundaryFixture();
  try {
    await fixture.install(
      "reader",
      `{
      commands:[{id:"inspect",title:"Inspect",run:ctx=>ctx.resource.metadata.target}],
      resourceKinds:[{id:"item"}],${boundaryReaderPresentation}
    }`,
    );
    await fixture.deps.projectInfoService.write(fixture.project.id, {
      composition: JSON.stringify({
        resourceOpeners: [
          {
            resourceKind: { kind: "resource-kind", extensionId: "example.reader", id: "item" },
            opener: { kind: "command", extensionId: "example.reader", id: "inspect" },
          },
        ],
      }),
    });
    const foreign = await fixture.deps.projectService.create({ name: "Foreign" });
    const workspace = await fixture.deps.workspaceService.createStandalone({ project_id: foreign.id });
    const resource = { type: "workspace", extensionId: "pstdio", id: workspace.id, projectId: fixture.project.id };
    const page = { kind: "page", page: { kind: "page", extensionId: "example.reader", id: "room" }, resource };
    const local = {
      kind: "page",
      page: page.page,
      resource: { type: "item", extensionId: "example.reader", id: "local", projectId: fixture.project.id },
    };
    const targets: JsonObject[] = [
      page,
      { kind: "panel", panel: { kind: "placement", extensionId: "example.reader", id: "viewer" }, resource },
      { ...local, parent: page },
      { kind: "compound", targets: [local, page] },
      local,
      { ...local, resource: { type: "unknown", extensionId: "pstdio", id: "missing" } },
      { ...local, resource: { type: "unknown", id: "missing" } },
    ];
    const results = await resolveResourceOpenings(
      fixture.deps,
      { projectId: fixture.project.id },
      targets.map((target, index) => ({
        type: "item",
        extensionId: "example.reader",
        id: String(index),
        metadata: { target },
      })),
    );
    expect(results.slice(0, 4).map((result) => result.target)).toEqual([undefined, undefined, undefined, undefined]);
    expect(results[4]?.target).toMatchObject(local);
    expect(results.slice(5).map((result) => result.target)).toEqual([undefined, undefined]);
  } finally {
    await fixture.close();
  }
});

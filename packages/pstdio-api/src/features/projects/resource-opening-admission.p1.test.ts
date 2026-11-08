import { expect, test } from "bun:test";
import { createResourcesApi } from "../extensions/command-environment/resources";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import { resolveResourceOpenings } from "./resource-openers";
import { createPausedOpeningFixture } from "./resource-openers.test-fixture";
import { createOpeningBoundaryFixture } from "./resource-opening-boundaries.test-fixture";

test("disabling a data owner while an independent opener waits withdraws the target", async () => {
  const fixture = await createPausedOpeningFixture("inspect");
  let opening: ReturnType<typeof resolveResourceOpenings> | undefined;
  try {
    await fixture.install(
      "presenter",
      `{
      commands:[{id:"inspect",title:"Inspect",run:async(ctx)=>{
        await fetch(${JSON.stringify(fixture.url)}+"inspect");
        return {kind:"page",page:{kind:"page",extensionId:"example.destination",id:"reading-room"},resource:ctx.resource};
      }}]
    }`,
    );
    await fixture.deps.projectInfoService.write(fixture.project.id, {
      composition: JSON.stringify({
        resourceOpeners: [
          {
            resourceKind: { kind: "resource-kind", extensionId: "example.reader", id: "entry" },
            opener: { kind: "command", extensionId: "example.presenter", id: "inspect" },
          },
        ],
      }),
    });
    opening = resolveResourceOpenings(fixture.deps, { projectId: fixture.project.id }, [fixture.resource]);
    await fixture.entered.promise;
    await fixture.deps.extensionService.setProjectExtensionEnabled(fixture.reader.instance.id, false);
    fixture.release.resolve();
    expect((await opening)[0]?.target).toBeUndefined();
    const { runtime } = await fixture.deps.extensionRuntimeCatalog.get(fixture.project.id);
    expect(runtime.commands.some((command) => command.id === "example.presenter.command.inspect")).toBe(true);
    expect(runtime.pages.some((page) => page.extensionId === "example.destination")).toBe(true);
  } finally {
    fixture.release.resolve();
    await opening;
    await fixture.close();
  }
});

for (const [method, end] of [
  ["listAnchors", "returned"],
  ["queryAnchorsMany", "cancelled"],
] as const) {
  test(`an anchor ${method} read cannot continue after its caller ${end}`, async () => {
    const fixture = await createOpeningBoundaryFixture();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const finished = Promise.withResolvers<void>();
    const controller = new AbortController();
    let continued = false;
    let laterReads = 0;
    let released = false;
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === "/entered") await entered.promise;
        if (path === "/continued") continued = true;
        if (path === "/finished") finished.resolve();
        return new Response("ok");
      },
    });
    let running: ReturnType<typeof executeProjectExtensionCommand> | undefined;
    try {
      const workspace = await fixture.deps.workspaceService.createStandalone({ project_id: fixture.project.id });
      const resource = { type: "workspace", extensionId: "pstdio", id: workspace.id };
      const api = createResourcesApi(fixture.deps, { projectId: fixture.project.id, extensionId: "example.reader" });
      await api.addAnchors(resource, [{ type: "project", extensionId: "pstdio", id: fixture.project.id }]);
      const listMethod = method === "listAnchors" ? "list" : "listMany";
      const read = fixture.deps.resourceLinksService[listMethod].bind(fixture.deps.resourceLinksService);
      fixture.deps.resourceLinksService[listMethod] = async (input) => {
        const result = await read(input as never);
        entered.resolve();
        await release.promise;
        return result;
      };
      const snapshot = fixture.deps.extensionRuntimeCatalog.get.bind(fixture.deps.extensionRuntimeCatalog);
      fixture.deps.extensionRuntimeCatalog.get = async (...args) => {
        if (released) laterReads++;
        return snapshot(...args);
      };
      const query = method === "listAnchors" ? { resource } : { resources: [resource] };
      const base = JSON.stringify(server.url.toString());
      await fixture.install(
        "reader",
        `{commands:[{id:"read",title:"Read",run:async(ctx)=>{
        const pending=ctx.resources.${method}(${JSON.stringify(query)}).then(()=>fetch(${base}+"continued"),()=>{}).finally(()=>fetch(${base}+"finished"));
        ${end === "returned" ? `void pending;await fetch(${base}+"entered");return {};` : "return await pending;"}
      }}]}`,
      );
      running = executeProjectExtensionCommand(fixture.deps, {
        projectId: fixture.project.id,
        commandId: "example.reader.command.read",
        body: {},
        signal: controller.signal,
      });
      await entered.promise;
      if (end === "returned") expect((await running).outcome.ok).toBe(true);
      else controller.abort();
      released = true;
      release.resolve();
      await running;
      await finished.promise;
      expect(continued).toBe(false);
      expect(laterReads).toBe(0);
    } finally {
      release.resolve();
      await running;
      await fixture.close();
      await server.stop(true);
    }
  });
}

test("an anchor validator cannot delete a session and its existing links", async () => {
  const fixture = await createOpeningBoundaryFixture();
  try {
    const session = await fixture.deps.sessionService.create({
      project_id: fixture.project.id,
      title: "Linked",
      agent: "test",
      status: "completed",
    });
    const api = createResourcesApi(fixture.deps, { projectId: fixture.project.id, extensionId: "example.guard" });
    const resource = { type: "session", extensionId: "pstdio", id: session.id };
    await api.addAnchors(resource, [{ type: "project", extensionId: "pstdio", id: fixture.project.id }]);
    await fixture.install(
      "guard",
      `{
      commands:[{id:"check",title:"Check",run:async(ctx)=>{await ctx.sessions.delete(${JSON.stringify(session.id)});return {allowed:false,reason:"Owner rejected"};}}],
      resourceKinds:[{id:"protected",validateAnchors:{kind:"command",id:"check"}}]
    }`,
    );
    const result = await api
      .addAnchors({ type: "protected", id: "outer" }, [
        { type: "project", extensionId: "pstdio", id: fixture.project.id },
      ])
      .then(
        () => "accepted",
        (error: Error) => error.message,
      );
    expect((await api.listAnchors({ resource })).items).toHaveLength(1);
    expect(result).toContain("cannot mutate");
  } finally {
    await fixture.close();
  }
});

test("a disabled returned target owner withdraws its opening while source and presenter stay enabled", async () => {
  const fixture = await createPausedOpeningFixture("inspect");
  let opening: ReturnType<typeof resolveResourceOpenings> | undefined;
  try {
    const target = await fixture.install(
      "target",
      `{
      resourceKinds:[{id:"entry"}],commands:[
        {id:"seed",title:"Seed",run:ctx=>ctx.storage.set("entry",{text:"Retained"})},
        {id:"read",title:"Read",run:ctx=>ctx.storage.get("entry")}
      ]
    }`,
    );
    await executeProjectExtensionCommand(fixture.deps, {
      projectId: fixture.project.id,
      commandId: "example.target.command.seed",
      body: {},
    });
    await fixture.install(
      "independent",
      `{
      views:[{id:"reader",title:"Reader",body:{kind:"controls",query:async()=>({fields:[],values:{}})}}],
      pages:[{id:"room",title:"Room",path:"room",mode:{kind:"mode",extensionId:"pstdio",id:"project"},
        resource:{kinds:[{kind:"resource-kind",extensionId:"example.target",id:"entry"}]},
        main:{kind:"view",view:{kind:"view",id:"reader"},cardinality:"one"},slots:[],panels:{}}]
    }`,
    );
    await fixture.install(
      "presenter",
      `{commands:[{id:"inspect",title:"Inspect",run:async()=>{
      await fetch(${JSON.stringify(fixture.url)}+"inspect");
      return {kind:"page",page:{kind:"page",extensionId:"example.independent",id:"room"},resource:{type:"entry",extensionId:"example.target",id:"entry"}};
    }}]}`,
    );
    await fixture.deps.projectInfoService.write(fixture.project.id, {
      composition: JSON.stringify({
        resourceOpeners: [
          {
            resourceKind: { kind: "resource-kind", extensionId: "example.reader", id: "entry" },
            opener: { kind: "command", extensionId: "example.presenter", id: "inspect" },
          },
        ],
      }),
    });
    opening = resolveResourceOpenings(fixture.deps, { projectId: fixture.project.id }, [fixture.resource]);
    await fixture.entered.promise;
    await fixture.deps.extensionService.setProjectExtensionEnabled(target.instance.id, false);
    fixture.release.resolve();
    expect((await opening)[0]?.target).toBeUndefined();
    const { runtime } = await fixture.deps.extensionRuntimeCatalog.get(fixture.project.id);
    expect(runtime.resourceKinds.some((kind) => kind.extensionId === "example.reader")).toBe(true);
    expect(runtime.commands.some((command) => command.id === "example.presenter.command.inspect")).toBe(true);
    expect(runtime.pages.some((page) => page.extensionId === "example.independent")).toBe(true);
    await fixture.deps.extensionService.setProjectExtensionEnabled(target.instance.id, true);
    const retained = await executeProjectExtensionCommand(fixture.deps, {
      projectId: fixture.project.id,
      commandId: "example.target.command.read",
      body: {},
    });
    expect(retained.outcome).toMatchObject({ ok: true, value: { text: "Retained" } });
  } finally {
    fixture.release.resolve();
    await opening;
    await fixture.close();
  }
});

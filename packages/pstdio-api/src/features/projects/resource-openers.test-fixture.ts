import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";

export const createPausedOpeningFixture = async (pause: "describe" | "inspect") => {
  const root = await mkdtemp(join(tmpdir(), "paused-openings-"));
  const fixture = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<void>();
  let opened = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === `/${pause}`) {
        entered.resolve();
        await release.promise;
      }
      if (path === "/wait-for-reader") await entered.promise;
      if (path === "/opened") opened++;
      if (path === "/finished") finished.resolve();
      return new Response("ok");
    },
  });
  const base = JSON.stringify(server.url.toString());
  const project = await fixture.deps.projectService.create({ name: "Paused openers" });
  const install = async (name: string, definition: string) => {
    const sourcePath = join(root, name);
    await mkdir(sourcePath);
    const manifest = {
      name,
      publisher: "example",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    };
    await writeFile(join(sourcePath, "package.json"), JSON.stringify(manifest));
    await writeFile(
      join(sourcePath, "extension.ts"),
      `const definition=${definition};
      for(const [field,kind] of [["commands","command"],["views","view"],["pages","page"],["resourceKinds","resource-kind"]])
        for(const item of definition[field]??[]) item.ref={kind,id:item.id};
      export default definition;`,
    );
    return fixture.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath,
      sourceKind: "local_path",
      name,
      installName: name,
      extensionId: `example.${name}`,
      displayName: name,
      manifest,
    });
  };
  const reader = await install(
    "reader",
    `{
    commands: [
      {id:"describe",title:"Describe",run:async(_,p)=>{await fetch(${base}+"describe");return p.resources.map(resource=>({resource}));}},
      {id:"inspect",title:"Inspect",run:async(ctx)=>{await fetch(${base}+"inspect");await fetch(${base}+"opened");return {kind:"page",page:{kind:"page",extensionId:"example.destination",id:"reading-room"},resource:ctx.resource};}}
    ],
    resourceKinds:[{id:"entry",resolveMany:{kind:"command",id:"describe"}}]
  }`,
  );
  await install(
    "destination",
    `{
    views:[{id:"reader",title:"Reader",body:{kind:"controls",query:async()=>({fields:[],values:{}})}}],
    pages:[{id:"reading-room",title:"Reading room",path:"reading-room",mode:{kind:"mode",extensionId:"pstdio",id:"project"},resource:{kinds:[{kind:"resource-kind",extensionId:"example.reader",id:"entry"}]},main:{kind:"view",view:{kind:"view",id:"reader"},cardinality:"one"},slots:[],panels:{}}]
  }`,
  );
  const resource = { type: "entry", extensionId: "example.reader", id: "one" };
  await install(
    "caller",
    `{
    commands:[{id:"open",title:"Open",run:async(ctx,p)=>{
      const reading=ctx.resources.resolveOpenings([${JSON.stringify(resource)}]);
      const tracked=reading.finally(()=>fetch(${base}+"finished"));
      if(p.detach){void tracked.catch(()=>{});await fetch(${base}+"wait-for-reader");return {};}
      return await tracked;
    }}]
  }`,
  );
  await fixture.deps.projectInfoService.write(project.id, {
    composition: JSON.stringify({
      resourceOpeners: [
        {
          resourceKind: { kind: "resource-kind", extensionId: "example.reader", id: "entry" },
          opener: { kind: "command", extensionId: "example.reader", id: "inspect" },
        },
      ],
    }),
  });
  return {
    ...fixture,
    project,
    reader,
    resource,
    entered,
    release,
    finished,
    opened: () => opened,
    close: async () => {
      release.resolve();
      await fixture.close();
      await server.stop(true);
      await rm(root, { recursive: true, force: true });
    },
  };
};

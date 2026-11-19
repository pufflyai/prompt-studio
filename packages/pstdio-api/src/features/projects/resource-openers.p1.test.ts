import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { createResourcesApi } from "../extensions/command-environment/resources";

test("configured public openers present host and extension resources independently of their data owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "resource-openers-"));
  const fixture = await createTestApp();
  try {
    const project = await fixture.deps.projectService.create({ name: "Openers" });
    const sourcePath = join(root, "reader");
    await mkdir(sourcePath);
    const manifest = {
      name: "reader",
      publisher: "example",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    };
    await writeFile(join(sourcePath, "package.json"), JSON.stringify(manifest));
    await writeFile(
      join(sourcePath, "extension.ts"),
      `export default {
      commands: [
        { id:"describe",ref:{kind:"command",id:"describe"},title:"Describe",run:(_,p)=>p.resources.map(resource=>({resource:{...resource,label:"Current entry"}})) },
        { id:"inspect",ref:{kind:"command",id:"inspect"},title:"Inspect",run:ctx=>({kind:"page",page:{kind:"page",id:"reading-room"},resource:ctx.resource}) }
      ],
      resourceKinds:[{id:"entry",ref:{kind:"resource-kind",id:"entry"},resolveMany:{kind:"command",id:"describe"}},{id:"unadorned",ref:{kind:"resource-kind",id:"unadorned"}}],
      views:[{id:"reader",ref:{kind:"view",id:"reader"},title:"Reader",body:{kind:"controls",query:async()=>({fields:[],values:{}})}}],
      pages:["reading-room","alternate"].map(id=>({id,ref:{kind:"page",id},title:id,path:id,mode:{kind:"mode",extensionId:"pstdio",id:"project"},resource:{kinds:[{kind:"resource-kind",extensionId:"pstdio",id:"workspace"},{kind:"resource-kind",id:"entry"},{kind:"resource-kind",id:"unadorned"}]},main:{kind:"view",view:{kind:"view",id:"reader"},cardinality:"one"},slots:[],panels:{}}))
    };`,
    );
    const installed = await fixture.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath,
      sourceKind: "local_path",
      name: "reader",
      installName: "reader",
      extensionId: "example.reader",
      displayName: "Reader",
      manifest,
    });
    const workspace = await fixture.deps.workspaceService.createStandalone({
      project_id: project.id,
      name: "Existing work",
    });
    const refs = [
      { type: "workspace", extensionId: "pstdio", id: workspace.id },
      { type: "entry", extensionId: "example.reader", id: "one" },
      { type: "unadorned", extensionId: "example.reader", id: "two" },
    ];
    const bindings = refs.map((ref) => ({
      resourceKind: { kind: "resource-kind", extensionId: ref.extensionId, id: ref.type },
      opener: { kind: "command", extensionId: "example.reader", id: "inspect" },
    }));
    await fixture.deps.projectInfoService.write(project.id, {
      composition: JSON.stringify({ resourceOpeners: bindings }),
    });
    const api = createResourcesApi(fixture.deps, { projectId: project.id, extensionId: "example.caller" });
    const openings = await api.resolveOpenings(refs);
    expect(openings).toHaveLength(3);
    for (const opening of openings)
      expect(opening.target).toMatchObject({
        kind: "page",
        page: { kind: "page", extensionId: "example.reader", id: "reading-room" },
      });
    expect(openings[0]?.resource.label).toBe("Existing work");
    expect(openings[1]?.resource.label).toBe("Current entry");
    const requestOpenings = (resources: typeof refs) =>
      fixture.app.request(`/v1/projects/${project.id}/resource-openings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resources }),
      });
    const response = await requestOpenings(refs);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(openings);
    expect(
      (
        await fixture.app.request(`/v1/projects/${project.id}/resource-openings`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resources: [{ ...refs[0]!, projectId: "another" }] }),
        })
      ).status,
    ).toBe(400);
    bindings[0]!.opener = { kind: "page", extensionId: "example.reader", id: "alternate" };
    await fixture.deps.projectInfoService.write(project.id, {
      composition: JSON.stringify({ resourceOpeners: bindings }),
    });
    expect((await api.resolveOpenings([refs[0]!]))[0]?.target).toMatchObject({
      kind: "page",
      page: { id: "alternate" },
    });
    await expect(api.resolveOpenings([{ ...refs[0]!, projectId: "another" }])).rejects.toThrow("another project");
    await fixture.deps.extensionService.setProjectExtensionEnabled(installed.instance.id, false);
    expect((await api.resolveOpenings([refs[0]!]))[0]?.target).toBeUndefined();
    expect(await fixture.deps.workspaceService.get(workspace.id)).toBeDefined();
  } finally {
    await fixture.close();
    await rm(root, { recursive: true, force: true });
  }
});

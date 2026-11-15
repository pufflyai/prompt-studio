import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";

export const createOpeningBoundaryFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "opening-boundaries-"));
  const app = await createTestApp();
  const project = await app.deps.projectService.create({ name: "Opening boundaries" });
  const install = async (name: string, definition: string) => {
    const sourcePath = join(root, name);
    await mkdir(sourcePath);
    const manifest = {
      publisher: "example",
      name,
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    };
    await writeFile(join(sourcePath, "package.json"), JSON.stringify(manifest));
    await writeFile(
      join(sourcePath, "extension.ts"),
      `const definition=${definition};
      for(const [field,kind] of [["commands","command"],["views","view"],["pages","page"],["resourceKinds","resource-kind"],["placements","placement"]])
        for(const item of definition[field]??[]) item.ref={kind,id:item.id};
      export default definition;`,
    );
    return app.deps.extensionService.enableInstalledSourceForProject({
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
  return {
    ...app,
    project,
    install,
    close: async () => {
      await app.close();
      await rm(root, { recursive: true, force: true });
    },
  };
};

export const boundaryReaderPresentation = `
  views:[{id:"reader",title:"Reader",body:{kind:"controls",query:async()=>({fields:[],values:{}})}}],
  placements:[{id:"viewer",mode:{kind:"mode",extensionId:"pstdio",id:"project"},region:"side",item:{kind:"binding",binding:{kinds:[{kind:"resource-kind",id:"item"},{kind:"resource-kind",extensionId:"pstdio",id:"workspace"}],view:{kind:"view",id:"reader"},cardinality:"many"}}}],
  pages:[{id:"room",title:"Room",path:"room",mode:{kind:"mode",extensionId:"pstdio",id:"project"},
    resource:{kinds:[{kind:"resource-kind",id:"item"},{kind:"resource-kind",extensionId:"pstdio",id:"workspace"}]},
    main:{kind:"view",view:{kind:"view",id:"reader"},cardinality:"one"},slots:[],panels:{}}]`;

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const registryNotesEngines = `^${EXTENSION_API_VERSION}`;

export const writeRegistryNotes = async (source: string, version: string) => {
  await mkdir(source, { recursive: true });
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "pstdio-notes",
      publisher: "pstdio",
      displayName: "Notes",
      version,
      main: "extension.ts",
      engines: { pstdio: registryNotesEngines },
    }),
  );
  await writeFile(
    join(source, "extension.ts"),
    `export default {commands:[{
    id:"version",ref:{kind:"command",id:"version"},title:"Version",cli:true,run(){return "${version}"}
  }],templates:[{
    id:"note",ref:{kind:"template",id:"note"},title:"Note",type:"note",
    source:{kind:"package-asset",path:"./note.md",baseUrl:import.meta.url}
  }]};`,
  );
  await writeFile(join(source, "note.md"), "# Note\n");
};

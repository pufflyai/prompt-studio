import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const registryNotesEngines = `^${EXTENSION_API_VERSION}`;

export const writeRegistryNotes = async (source: string, version: string) => {
  await mkdir(source, { recursive: true });
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "notes",
      publisher: "pstdio",
      displayName: "Notes",
      version,
      main: "extension.ts",
      engines: { pstdio: registryNotesEngines },
    }),
  );
  await writeFile(
    join(source, "extension.ts"),
    `import { readVersion } from "./version";
    export default {commands:[{
    id:"version",ref:{kind:"command",id:"version"},title:"Version",cli:true,run(){return readVersion()}
  }],templates:[{
    id:"note",ref:{kind:"template",id:"note"},title:"Note",type:"note",
    source:{kind:"package-asset",path:"./note.md",baseUrl:import.meta.url}
  }]};`,
  );
  // The installed command must survive incidental CSS in a public helper under compiled Bun.
  await writeFile(
    join(source, "version.ts"),
    `import "./style.css"; export const readVersion = () => ${JSON.stringify(version)};`,
  );
  await writeFile(join(source, "style.css"), ".notes-fixture { color: var(--fg); }\n");
  await writeFile(join(source, "note.md"), "# Note\n");
};

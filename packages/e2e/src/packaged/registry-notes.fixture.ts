import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
      engines: { pstdio: "^0.2.0" },
    }),
  );
  await writeFile(
    join(source, "extension.ts"),
    `export default {commands:[{
    id:"version",ref:{kind:"command",id:"version"},title:"Version",cli:true,run(){return "${version}"}
  }]};`,
  );
};

import { resolve } from "node:path";
import { sessionImportSourceSchema } from "pstdio-api-contracts";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "import";
export const describe = "Import conversations from an exported JSONL backup";
export const builder = (yargs: Argv) =>
  yargs
    .option("source", {
      type: "string",
      demandOption: true,
      describe: "Backup, export, or tables folder on the API host",
    })
    .option("storage", { type: "string", describe: "Folder holding the exported conversation and attachment bytes" })
    .option("project-map", {
      type: "string",
      describe: "JSON file mapping source project IDs to existing destination project IDs",
    })
    .option("dry-run", {
      type: "boolean",
      default: false,
      describe: "Inspect recoverable sessions without importing them",
    });
export interface ImportArgs {
  source: string;
  storage?: string;
  projectMap?: string;
  dryRun: boolean;
}
export const createHandler =
  (deps = { client: apiClient, log: console.log }) =>
  async (argv: Arguments<ImportArgs>) => {
    const input = sessionImportSourceSchema.parse({
      sourcePath: resolve(argv.source),
      storagePath: argv.storage ? resolve(argv.storage) : undefined,
      projectMap: argv.projectMap ? await Bun.file(resolve(argv.projectMap)).json() : {},
    });
    if (!argv.dryRun && !Object.keys(input.projectMap).length)
      throw new Error(
        "Use --project-map to select source projects and their destinations, or --dry-run to inspect the backup.",
      );
    const imports = deps.client().sessions.imports;
    deps.log(JSON.stringify(await (argv.dryRun ? imports.preview(input) : imports.start(input))));
  };
export const handler = createHandler();

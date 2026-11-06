import { resolve } from "node:path";
import type { Arguments, Argv } from "yargs";
import { defaultFolderCommandDeps, type FolderCommandDeps, sourceOptions, waitForFolderOperation } from "./wait";

export const command = "restore <id>";
export const describe =
  "Restore a device's folder copy into a new folder. The folder appears only after every entry is verified";
export const builder = (yargs: Argv) =>
  sourceOptions(yargs).option("path", {
    type: "string",
    demandOption: true,
    describe: "New folder to create; it must not exist yet",
  });
export type RestoreArgs = { id: string; device: string; source: string; path: string; wait: boolean };

export const createHandler =
  (deps: FolderCommandDeps = defaultFolderCommandDeps) =>
  async (args: Arguments<RestoreArgs>) => {
    // The host runs elsewhere, so a relative folder is the caller's. It expands `~/` itself.
    const path = args.path === "~" || args.path.startsWith("~/") ? args.path : resolve(deps.cwd(), args.path);
    const started = await deps
      .projects()
      .restoreFolder(args.id, { deviceId: args.device, sourceId: args.source, path });
    if (!args.wait) return deps.log(JSON.stringify(started, null, 2));
    await waitForFolderOperation(deps, args.id, "restore", started);
  };
export const handler = createHandler();

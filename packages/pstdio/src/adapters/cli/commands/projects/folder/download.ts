import type { Arguments, Argv } from "yargs";
import { defaultFolderCommandDeps, type FolderCommandDeps, sourceOptions, waitForFolderOperation } from "./wait";

export const command = "download <id>";
export const describe = "Download a device's folder copy to this device, so it can be restored offline";
export const builder = (yargs: Argv) => sourceOptions(yargs);
export type DownloadArgs = { id: string; device: string; source: string; wait: boolean };

export const createHandler =
  (deps: FolderCommandDeps = defaultFolderCommandDeps) =>
  async (args: Arguments<DownloadArgs>) => {
    const started = await deps.projects().downloadFolder(args.id, { deviceId: args.device, sourceId: args.source });
    if (!args.wait) return deps.log(JSON.stringify(started, null, 2));
    await waitForFolderOperation(deps, args.id, "download", started);
  };
export const handler = createHandler();

import {
  readUpdateChannel,
  resolvePstdioUpdateChannelPath,
  UPDATE_CHANNELS,
  type UpdateChannel,
  updateChannelAvailable,
  writeUpdateChannel,
} from "pstdio-paths";
import type { Argv } from "yargs";

export const command = "update-channel [channel]";
export const describe = "Show or change which builds Prompt Studio desktop updates to on this device";

export const builder = (yargs: Argv) =>
  yargs.positional("channel", {
    type: "string",
    choices: UPDATE_CHANNELS,
    describe: "stable for released versions, nightly for a daily build of main",
  });

type Deps = {
  resolvePath: () => string;
  platform: NodeJS.Platform;
  log: (message: string) => void;
};

const defaultDeps: Deps = {
  resolvePath: () => resolvePstdioUpdateChannelPath(),
  platform: process.platform,
  log: console.log,
};

// Writes the same device file the desktop settings panel changes, so a person and
// an agent switch channels the same way. The app reads it before every update check.
export const createHandler =
  (deps: Partial<Deps> = {}) =>
  async (args: { channel?: string }) => {
    const resolvedDeps = { ...defaultDeps, ...deps };
    const available = updateChannelAvailable(resolvedDeps.platform);
    const path = resolvedDeps.resolvePath();
    if (!args.channel) {
      resolvedDeps.log(available ? readUpdateChannel(path) : "stable");
      return;
    }
    if (!available) throw new Error("Nightly builds are only published for macOS and Linux.");
    const channel = args.channel as UpdateChannel;
    writeUpdateChannel(path, channel);
    resolvedDeps.log(`Update channel set to ${channel}. Use Check for Updates in Prompt Studio desktop to update now.`);
  };

export const handler = createHandler();

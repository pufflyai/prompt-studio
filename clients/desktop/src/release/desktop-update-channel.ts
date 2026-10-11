import { readUpdateChannel, type UpdateChannel, updateChannelAvailable, writeUpdateChannel } from "pstdio-paths";

interface DesktopUpdateChannelInput {
  path: string;
  platform: NodeJS.Platform;
  packaged: boolean;
}

// Source builds have no updater, and nightlies are not built for every platform.
// Those apps always follow stable and report no channel to choose.
export const createDesktopUpdateChannel = (input: DesktopUpdateChannelInput) => {
  const available = input.packaged && updateChannelAvailable(input.platform);
  return {
    choice: () => (available ? readUpdateChannel(input.path) : null),
    current: (): UpdateChannel => (available ? readUpdateChannel(input.path) : "stable"),
    set: (channel: UpdateChannel) => {
      if (!available) throw new Error("This app cannot change its update channel.");
      writeUpdateChannel(input.path, channel);
    },
  };
};

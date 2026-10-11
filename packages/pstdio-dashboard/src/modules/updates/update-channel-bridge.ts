export type UpdateChannel = "stable" | "nightly";

// The desktop app owns the update channel. The dashboard only reads and writes it
// through these calls on `globalThis.promptStudioDesktop`.
export interface UpdateChannelBridge {
  getAppInfo: () => Promise<{ version: string }>;
  /** `null` means this build cannot change channel, such as a source build or Windows. */
  getUpdateChannel: () => Promise<UpdateChannel | null>;
  setUpdateChannel: (channel: UpdateChannel) => Promise<void>;
}

export const hasUpdateChannelBridge = (bridge: unknown): bridge is UpdateChannelBridge =>
  Boolean(
    bridge &&
      typeof bridge === "object" &&
      "getUpdateChannel" in bridge &&
      typeof bridge.getUpdateChannel === "function",
  );

import type { HarnessContext } from "@pstdio/sdk/extensions";

export const ctx: HarnessContext = {
  extensionId: "pstdio.harness-open-code",
  name: "harness-open-code",
  connections: {
    request: async () => {
      throw new Error("No connections are configured in this test");
    },
    stream: async function* () {
      yield { type: "end" } as const;
    },
  },
  process: {
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
};

export const serviceOverrides = () => ({
  startServer: async () => ({ url: "http://localhost:4096", dispose: async () => {} }),
  serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
  pingServer: async () => true,
  isPortOpen: async () => true,
});

export const harnessDefaults = () => ({
  detect: async () => ({ available: true }),
  getModelsOutput: async () => "",
  pollIntervalMs: 1,
});

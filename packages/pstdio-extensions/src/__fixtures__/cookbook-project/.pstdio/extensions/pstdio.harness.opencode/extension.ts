import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "pstdio.harness.opencode",
  name: "OpenCode Harness",
  harnesses: {
    opencode: {
      id: "pstdio.harness.opencode",
      label: "OpenCode",
      async detect() {
        return { available: true };
      },
      async start(_ctx, input) {
        return { runId: input.sessionId };
      },
      async send() {},
      async stop() {},
    },
  },
});

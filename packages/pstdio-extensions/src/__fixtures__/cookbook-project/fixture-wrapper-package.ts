import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "local.wrapper",
  name: "Local Wrapper",
  commands: {
    refresh: {
      title: "Refresh wrapped package",
      target: "project",
      async run() {},
    },
  },
});

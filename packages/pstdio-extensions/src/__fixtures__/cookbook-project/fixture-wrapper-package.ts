import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "project.wrapper",
  name: "Project Wrapper",
  commands: {
    refresh: {
      title: "Refresh wrapped package",
      target: "project",
      async run() {},
    },
  },
});

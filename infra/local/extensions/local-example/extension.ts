import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    hello: {
      title: "Say hello from the local example",
      palette: {
        group: "Local Example",
        label: "Say hello from the local example",
      },
      async run() {
        return { message: "The repo-local extension is running." };
      },
    },
  },
});

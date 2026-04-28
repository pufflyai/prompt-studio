import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "project.tickets",
  name: "Tickets",
  artifactMounts: {
    tickets: {
      path: ".pstdio/tickets",
      label: "Tickets",
    },
  },
});

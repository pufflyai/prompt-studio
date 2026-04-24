import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "pstdio.tickets",
  name: "Tickets",
  artifactMounts: {
    tickets: {
      path: ".pstdio/tickets",
      label: "Tickets",
    },
  },
  commands: {
    pullTickets: {
      title: "Pull tickets",
      target: "project",
      cli: {
        path: "tickets pull",
        description: "Pull tickets into .pstdio/tickets",
      },
      async run() {},
    },
    pushTickets: {
      title: "Push tickets",
      target: "project",
      cli: {
        path: "tickets push",
        description: "Push local ticket edits",
      },
      async run() {},
    },
  },
});

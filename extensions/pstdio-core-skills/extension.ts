import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "pstdio.core-skills",
  namespace: "core-skills",
  name: "Core Skills",
  version: "0.1.0",
  apiVersion: "1",
  description: "Built-in pstdio agent skills.",

  skills: {
    create_proposal: { title: "Create a proposal", source: packageAsset("./skills/create-proposal", import.meta.url) },
    create_pstdio_plugin: {
      title: "Create a pstdio plugin",
      source: packageAsset("./skills/create-pstdio-plugin", import.meta.url),
    },
    create_sub_tickets: {
      title: "Create sub-tickets",
      source: packageAsset("./skills/create-sub-tickets", import.meta.url),
    },
    create_ticket: { title: "Create a ticket", source: packageAsset("./skills/create-ticket", import.meta.url) },
    implement_ticket: {
      title: "Implement a ticket",
      source: packageAsset("./skills/implement-ticket", import.meta.url),
    },
    pstdio: { title: "Use pstdio", source: packageAsset("./skills/pstdio", import.meta.url) },
    refine_ticket: { title: "Refine a ticket", source: packageAsset("./skills/refine-ticket", import.meta.url) },
  },
});

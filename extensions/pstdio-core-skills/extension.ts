import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  skills: {
    create_proposal: { title: "Create a proposal", source: packageAsset("./skills/create-proposal", import.meta.url) },
    create_pstdio_extension: {
      title: "Create a pstdio extension",
      source: packageAsset("./skills/create-pstdio-extension", import.meta.url),
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

import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

const asset = (path: string) => packageAsset(path, import.meta.url);

export default defineExtension({
  id: "pstdio.core-skills",
  namespace: "core-skills",
  name: "Core Skills",
  version: "0.1.0",
  apiVersion: "1",
  description: "Built-in pstdio agent skills.",

  skills: {
    create_proposal: { title: "Create a proposal", source: asset("./skills/create-proposal") },
    create_pstdio_plugin: { title: "Create a pstdio plugin", source: asset("./skills/create-pstdio-plugin") },
    create_sub_tickets: { title: "Create sub-tickets", source: asset("./skills/create-sub-tickets") },
    create_ticket: { title: "Create a ticket", source: asset("./skills/create-ticket") },
    implement_ticket: { title: "Implement a ticket", source: asset("./skills/implement-ticket") },
    pstdio: { title: "Use pstdio", source: asset("./skills/pstdio") },
    refine_ticket: { title: "Refine a ticket", source: asset("./skills/refine-ticket") },
  },
});

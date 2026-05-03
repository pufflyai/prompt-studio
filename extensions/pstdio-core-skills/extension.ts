import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

const skill = (key: string, title: string) => ({
  title,
  source: packageAsset(`./skills/${key}`, import.meta.url),
});

export default defineExtension({
  id: "pstdio.core-skills",
  namespace: "core-skills",
  name: "Core Skills",
  version: "0.1.0",
  description: "Built-in pstdio agent skills.",

  skills: {
    "create-proposal": skill("create-proposal", "Create a proposal"),
    "create-pstdio-plugin": skill("create-pstdio-plugin", "Create a pstdio plugin"),
    "create-sub-tickets": skill("create-sub-tickets", "Create sub-tickets"),
    "create-ticket": skill("create-ticket", "Create a ticket"),
    "implement-ticket": skill("implement-ticket", "Implement a ticket"),
    pstdio: skill("pstdio", "Use pstdio"),
    "refine-ticket": skill("refine-ticket", "Refine a ticket"),
  },
});

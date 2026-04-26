import { defineExtension, packageAsset, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "local.extension-lab",
  name: "Extension Lab",
  version: "0.1.0",
  artifactMounts: {
    tickets: {
      path: ".pstdio/tickets",
      label: "Tickets",
    },
  },
  templateTypes: {
    ticket: {
      label: "Ticket",
      description: "Ticket templates used by the local extension lab.",
    },
  },
  templates: {
    labTicket: {
      title: "Extension Lab Ticket",
      type: "ticket",
      source: packageAsset("./templates/lab-ticket.md", import.meta.url),
      description: "Small ticket template that proves package asset resolution.",
    },
  },
  skills: {
    labSkill: {
      title: "Extension Lab Skill",
      source: packageAsset("./skills/lab-skill.md", import.meta.url),
      description: "Small skill asset that proves package asset resolution.",
    },
  },
  commands: {
    inspectProject: {
      title: "Inspect extension lab project",
      target: "project",
      params: {
        note: params.text({
          label: "Note",
          description: "Optional note for future command execution tests.",
        }),
      },
      cli: {
        path: "extension-lab inspect",
        description: "Inspect the local extension lab setup",
        examples: ["pstdio extension-lab inspect"],
      },
      async run() {},
    },
  },
});

import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

const dir = { ticket: "tickets", prompt: "prompts", document: "documents" } as const;
const suffix = { ticket: "ticket", prompt: "prompt", document: "template" } as const;

const tpl = (key: string, type: "ticket" | "prompt" | "document", title: string) => ({
  title,
  type,
  source: packageAsset(`./templates/${dir[type]}/${key}.${suffix[type]}.md`, import.meta.url),
});

export default defineExtension({
  id: "pstdio.core-templates",
  namespace: "core-templates",
  name: "Core Templates",
  version: "0.1.0",
  description: "Built-in pstdio templates.",

  templateTypes: {
    ticket: { label: "Ticket", description: "Ticket templates" },
    prompt: { label: "Prompt", description: "Prompt templates" },
    document: { label: "Document", description: "Document templates" },
  },

  templates: {
    // documents
    prd: tpl("prd", "document", "PRD"),
    adr: tpl("adr", "document", "ADR"),
    "changelog-entry": tpl("changelog-entry", "document", "Changelog entry"),
    cookbook: tpl("cookbook", "document", "Cookbook"),
    "lessons-learned": tpl("lessons-learned", "document", "Lessons learned"),
    "code-review": tpl("code-review", "document", "Code review"),
    "architecture-overview": tpl("architecture-overview", "document", "Architecture overview"),
    contracts: tpl("contracts", "document", "Contracts"),
    research: tpl("research", "document", "Research"),
    schemas: tpl("schemas", "document", "Schemas"),
    // prompts
    "commit-message": tpl("commit-message", "prompt", "Commit message"),
    "create-sub-tickets": tpl("create-sub-tickets", "prompt", "Create sub-tickets"),
    "implement-ticket": tpl("implement-ticket", "prompt", "Implement ticket"),
    "refine-ticket": tpl("refine-ticket", "prompt", "Refine ticket"),
    "squash-message": tpl("squash-message", "prompt", "Squash message"),
    "fix-changes-requested": tpl("fix-changes-requested", "prompt", "Fix changes requested"),
    "review-code": tpl("review-code", "prompt", "Review code"),
    // tickets
    ticket: tpl("ticket", "ticket", "Ticket"),
    "bug-fix": tpl("bug-fix", "ticket", "Bug fix"),
    proposal: tpl("proposal", "ticket", "Proposal"),
  },
});

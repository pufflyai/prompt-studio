import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "pstdio.core-templates",
  namespace: "core-templates",
  name: "Core Templates",
  version: "0.1.0",
  apiVersion: "1",
  description: "Built-in pstdio templates.",

  templateTypes: {
    ticket: { label: "Ticket", description: "Ticket templates" },
    prompt: { label: "Prompt", description: "Prompt templates" },
    document: { label: "Document", description: "Document templates" },
  },

  templates: {
    // documents
    prd: {
      title: "PRD",
      type: "document",
      source: packageAsset("./templates/documents/prd.template.md", import.meta.url),
    },
    adr: {
      title: "ADR",
      type: "document",
      source: packageAsset("./templates/documents/adr.template.md", import.meta.url),
    },
    changelog_entry: {
      title: "Changelog entry",
      type: "document",
      source: packageAsset("./templates/documents/changelog-entry.template.md", import.meta.url),
    },
    cookbook: {
      title: "Cookbook",
      type: "document",
      source: packageAsset("./templates/documents/cookbook.template.md", import.meta.url),
    },
    lessons_learned: {
      title: "Lessons learned",
      type: "document",
      source: packageAsset("./templates/documents/lessons-learned.template.md", import.meta.url),
    },
    code_review: {
      title: "Code review",
      type: "document",
      source: packageAsset("./templates/documents/code-review.template.md", import.meta.url),
    },
    architecture_overview: {
      title: "Architecture overview",
      type: "document",
      source: packageAsset("./templates/documents/architecture-overview.template.md", import.meta.url),
    },
    contracts: {
      title: "Contracts",
      type: "document",
      source: packageAsset("./templates/documents/contracts.template.md", import.meta.url),
    },
    research: {
      title: "Research",
      type: "document",
      source: packageAsset("./templates/documents/research.template.md", import.meta.url),
    },
    schemas: {
      title: "Schemas",
      type: "document",
      source: packageAsset("./templates/documents/schemas.template.md", import.meta.url),
    },

    // prompts
    commit_message: {
      title: "Commit message",
      type: "prompt",
      source: packageAsset("./templates/prompts/commit-message.prompt.md", import.meta.url),
    },
    create_sub_tickets: {
      title: "Create sub-tickets",
      type: "prompt",
      source: packageAsset("./templates/prompts/create-sub-tickets.prompt.md", import.meta.url),
    },
    implement_ticket: {
      title: "Implement ticket",
      type: "prompt",
      source: packageAsset("./templates/prompts/implement-ticket.prompt.md", import.meta.url),
    },
    refine_ticket: {
      title: "Refine ticket",
      type: "prompt",
      source: packageAsset("./templates/prompts/refine-ticket.prompt.md", import.meta.url),
    },
    squash_message: {
      title: "Squash message",
      type: "prompt",
      source: packageAsset("./templates/prompts/squash-message.prompt.md", import.meta.url),
    },
    fix_changes_requested: {
      title: "Fix changes requested",
      type: "prompt",
      source: packageAsset("./templates/prompts/fix-changes-requested.prompt.md", import.meta.url),
    },
    review_code: {
      title: "Review code",
      type: "prompt",
      source: packageAsset("./templates/prompts/review-code.prompt.md", import.meta.url),
    },

    // tickets
    ticket: {
      title: "Ticket",
      type: "ticket",
      source: packageAsset("./templates/tickets/ticket.ticket.md", import.meta.url),
    },
    bug_fix: {
      title: "Bug fix",
      type: "ticket",
      source: packageAsset("./templates/tickets/bug-fix.ticket.md", import.meta.url),
    },
    proposal: {
      title: "Proposal",
      type: "ticket",
      source: packageAsset("./templates/tickets/proposal.ticket.md", import.meta.url),
    },
  },
});

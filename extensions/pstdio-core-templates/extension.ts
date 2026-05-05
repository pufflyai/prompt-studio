import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

const asset = (path: string) => packageAsset(path, import.meta.url);

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
    prd: { title: "PRD", type: "document", source: asset("./templates/documents/prd.template.md") },
    adr: { title: "ADR", type: "document", source: asset("./templates/documents/adr.template.md") },
    changelog_entry: {
      title: "Changelog entry",
      type: "document",
      source: asset("./templates/documents/changelog-entry.template.md"),
    },
    cookbook: {
      title: "Cookbook",
      type: "document",
      source: asset("./templates/documents/cookbook.template.md"),
    },
    lessons_learned: {
      title: "Lessons learned",
      type: "document",
      source: asset("./templates/documents/lessons-learned.template.md"),
    },
    code_review: {
      title: "Code review",
      type: "document",
      source: asset("./templates/documents/code-review.template.md"),
    },
    architecture_overview: {
      title: "Architecture overview",
      type: "document",
      source: asset("./templates/documents/architecture-overview.template.md"),
    },
    contracts: {
      title: "Contracts",
      type: "document",
      source: asset("./templates/documents/contracts.template.md"),
    },
    research: {
      title: "Research",
      type: "document",
      source: asset("./templates/documents/research.template.md"),
    },
    schemas: {
      title: "Schemas",
      type: "document",
      source: asset("./templates/documents/schemas.template.md"),
    },

    // prompts
    commit_message: {
      title: "Commit message",
      type: "prompt",
      source: asset("./templates/prompts/commit-message.prompt.md"),
    },
    create_sub_tickets: {
      title: "Create sub-tickets",
      type: "prompt",
      source: asset("./templates/prompts/create-sub-tickets.prompt.md"),
    },
    implement_ticket: {
      title: "Implement ticket",
      type: "prompt",
      source: asset("./templates/prompts/implement-ticket.prompt.md"),
    },
    refine_ticket: {
      title: "Refine ticket",
      type: "prompt",
      source: asset("./templates/prompts/refine-ticket.prompt.md"),
    },
    squash_message: {
      title: "Squash message",
      type: "prompt",
      source: asset("./templates/prompts/squash-message.prompt.md"),
    },
    fix_changes_requested: {
      title: "Fix changes requested",
      type: "prompt",
      source: asset("./templates/prompts/fix-changes-requested.prompt.md"),
    },
    review_code: {
      title: "Review code",
      type: "prompt",
      source: asset("./templates/prompts/review-code.prompt.md"),
    },

    // tickets
    ticket: {
      title: "Ticket",
      type: "ticket",
      source: asset("./templates/tickets/ticket.ticket.md"),
    },
    bug_fix: {
      title: "Bug fix",
      type: "ticket",
      source: asset("./templates/tickets/bug-fix.ticket.md"),
    },
    proposal: {
      title: "Proposal",
      type: "ticket",
      source: asset("./templates/tickets/proposal.ticket.md"),
    },
  },
});

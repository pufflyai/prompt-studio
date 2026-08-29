import { defineTemplate, packageAsset } from "@pstdio/sdk/extensions";

export const plannerTemplateAssets = [
  { id: "prd", title: "PRD", type: "document", path: "templates/documents/prd.template.md" },
  { id: "adr", title: "ADR", type: "document", path: "templates/documents/adr.template.md" },
  {
    id: "changelog-entry",
    title: "Changelog entry",
    type: "document",
    path: "templates/documents/changelog-entry.template.md",
  },
  { id: "cookbook", title: "Cookbook", type: "document", path: "templates/documents/cookbook.template.md" },
  {
    id: "lessons-learned",
    title: "Lessons learned",
    type: "document",
    path: "templates/documents/lessons-learned.template.md",
  },
  {
    id: "code-review",
    title: "Code review",
    type: "document",
    path: "templates/documents/code-review.template.md",
  },
  {
    id: "architecture-overview",
    title: "Architecture overview",
    type: "document",
    path: "templates/documents/architecture-overview.template.md",
  },
  { id: "contracts", title: "Contracts", type: "document", path: "templates/documents/contracts.template.md" },
  { id: "research", title: "Research", type: "document", path: "templates/documents/research.template.md" },
  { id: "schemas", title: "Schemas", type: "document", path: "templates/documents/schemas.template.md" },
  { id: "ticket", title: "Ticket", type: "ticket", path: "templates/tickets/ticket.ticket.md" },
  { id: "bug-fix", title: "Bug fix", type: "ticket", path: "templates/tickets/bug-fix.ticket.md" },
  { id: "proposal", title: "Proposal", type: "ticket", path: "templates/tickets/proposal.ticket.md" },
  {
    id: "create-sub-tickets",
    title: "Create sub-tickets",
    type: "prompt",
    path: "templates/prompts/create-sub-tickets.prompt.md",
  },
  {
    id: "implement-ticket",
    title: "Implement ticket",
    type: "prompt",
    path: "templates/prompts/implement-ticket.prompt.md",
  },
  {
    id: "refine-ticket",
    title: "Refine ticket",
    type: "prompt",
    path: "templates/prompts/refine-ticket.prompt.md",
  },
  { id: "review-code", title: "Review code", type: "prompt", path: "templates/prompts/review-code.prompt.md" },
  {
    id: "commit-message",
    title: "Commit message",
    type: "prompt",
    path: "templates/prompts/commit-message.prompt.md",
  },
  {
    id: "squash-message",
    title: "Squash message",
    type: "prompt",
    path: "templates/prompts/squash-message.prompt.md",
  },
] as const;

export const plannerTemplates = plannerTemplateAssets.map((template) =>
  defineTemplate({
    id: template.id,
    title: template.title,
    type: template.type,
    source: packageAsset(`./${template.path}`, import.meta.url),
  }),
);

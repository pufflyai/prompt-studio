import { defineTemplate, packageAsset } from "@pstdio/sdk/extensions";

export const documentTemplates = [
  defineTemplate({
    id: "prd",
    title: "PRD",
    type: "document",
    source: packageAsset("./templates/documents/prd.template.md", import.meta.url),
  }),
  defineTemplate({
    id: "adr",
    title: "ADR",
    type: "document",
    source: packageAsset("./templates/documents/adr.template.md", import.meta.url),
  }),
  defineTemplate({
    id: "changelog_entry",
    title: "Changelog entry",
    type: "document",
    source: packageAsset("./templates/documents/changelog-entry.template.md", import.meta.url),
  }),
  defineTemplate({
    id: "cookbook",
    title: "Cookbook",
    type: "document",
    source: packageAsset("./templates/documents/cookbook.template.md", import.meta.url),
  }),
  defineTemplate({
    id: "lessons_learned",
    title: "Lessons learned",
    type: "document",
    source: packageAsset("./templates/documents/lessons-learned.template.md", import.meta.url),
  }),
  defineTemplate({
    id: "code_review",
    title: "Code review",
    type: "document",
    source: packageAsset("./templates/documents/code-review.template.md", import.meta.url),
  }),
  defineTemplate({
    id: "architecture_overview",
    title: "Architecture overview",
    type: "document",
    source: packageAsset("./templates/documents/architecture-overview.template.md", import.meta.url),
  }),
  defineTemplate({
    id: "contracts",
    title: "Contracts",
    type: "document",
    source: packageAsset("./templates/documents/contracts.template.md", import.meta.url),
  }),
  defineTemplate({
    id: "research",
    title: "Research",
    type: "document",
    source: packageAsset("./templates/documents/research.template.md", import.meta.url),
  }),
  defineTemplate({
    id: "schemas",
    title: "Schemas",
    type: "document",
    source: packageAsset("./templates/documents/schemas.template.md", import.meta.url),
  }),
];

export const sharedPromptTemplates = [
  defineTemplate({
    id: "commit_message",
    title: "Commit message",
    type: "prompt",
    source: packageAsset("./templates/prompts/commit-message.prompt.md", import.meta.url),
  }),
  defineTemplate({
    id: "squash_message",
    title: "Squash message",
    type: "prompt",
    source: packageAsset("./templates/prompts/squash-message.prompt.md", import.meta.url),
  }),
];

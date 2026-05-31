import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  templateTypes: {
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
    squash_message: {
      title: "Squash message",
      type: "prompt",
      source: packageAsset("./templates/prompts/squash-message.prompt.md", import.meta.url),
    },
  },
});

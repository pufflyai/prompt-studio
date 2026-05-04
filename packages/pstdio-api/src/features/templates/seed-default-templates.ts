import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { TemplatesRouteDeps } from "./deps";

// Folder name determines template_type (strip trailing 's')
const TEMPLATE_FOLDERS = ["documents", "prompts", "tickets"] as const;
type TemplateFolder = (typeof TEMPLATE_FOLDERS)[number];

const folderToType = (folder: TemplateFolder) => folder.slice(0, -1) as "document" | "prompt" | "ticket";

interface BundledTemplate {
  name: string;
  folder: TemplateFolder;
  file_name: string;
  is_default: boolean;
}

const BUNDLED_TEMPLATES: BundledTemplate[] = [
  // documents
  { name: "prd", folder: "documents", file_name: "prd.template.md", is_default: true },
  { name: "adr", folder: "documents", file_name: "adr.template.md", is_default: false },
  { name: "changelog-entry", folder: "documents", file_name: "changelog-entry.template.md", is_default: false },
  { name: "cookbook", folder: "documents", file_name: "cookbook.template.md", is_default: false },
  { name: "lessons-learned", folder: "documents", file_name: "lessons-learned.template.md", is_default: false },
  { name: "code-review", folder: "documents", file_name: "code-review.template.md", is_default: false },
  {
    name: "architecture-overview",
    folder: "documents",
    file_name: "architecture-overview.template.md",
    is_default: false,
  },
  { name: "contracts", folder: "documents", file_name: "contracts.template.md", is_default: false },
  { name: "research", folder: "documents", file_name: "research.template.md", is_default: false },
  { name: "schemas", folder: "documents", file_name: "schemas.template.md", is_default: false },
  // prompts
  { name: "commit-message", folder: "prompts", file_name: "commit-message.prompt.md", is_default: true },
  { name: "create-sub-tickets", folder: "prompts", file_name: "create-sub-tickets.prompt.md", is_default: false },
  { name: "implement-ticket", folder: "prompts", file_name: "implement-ticket.prompt.md", is_default: false },
  { name: "refine-ticket", folder: "prompts", file_name: "refine-ticket.prompt.md", is_default: false },
  { name: "squash-message", folder: "prompts", file_name: "squash-message.prompt.md", is_default: false },
  { name: "fix-changes-requested", folder: "prompts", file_name: "fix-changes-requested.prompt.md", is_default: false },
  { name: "review-code", folder: "prompts", file_name: "review-code.prompt.md", is_default: false },
  // tickets
  { name: "ticket", folder: "tickets", file_name: "ticket.md", is_default: true },
  { name: "bug-fix", folder: "tickets", file_name: "bug-fix.ticket.md", is_default: false },
  { name: "proposal", folder: "tickets", file_name: "proposal.ticket.md", is_default: false },
];

const templatePath = (template: BundledTemplate) => `${template.folder}/${template.file_name}`;

type EmbeddedFile = Blob & { name: string };

const getEmbeddedFiles = () => {
  const files = (Bun as Record<string, unknown>).embeddedFiles;
  return Array.isArray(files) ? (files as EmbeddedFile[]) : [];
};

const getEmbeddedTemplate = (embeddedFiles: EmbeddedFile[], path: string) =>
  embeddedFiles.find((file) => file.name.endsWith(`/files/templates/${path}`));

const loadEmbeddedTemplateContents = async () => {
  const embeddedFiles = getEmbeddedFiles();
  if (embeddedFiles.length === 0) return null;

  const contents = new Map<string, string>();

  for (const template of BUNDLED_TEMPLATES) {
    const path = templatePath(template);
    const embedded = getEmbeddedTemplate(embeddedFiles, path);
    if (!embedded) return null;
    contents.set(path, await embedded.text());
  }

  return contents;
};

const resolveBundledTemplatesDir = () => {
  const templatesDir = resolve(import.meta.dirname, "../../../../pstdio/files/templates");
  if (!existsSync(templatesDir)) {
    throw new Error(`Bundled templates directory not found: ${templatesDir}`);
  }
  return templatesDir;
};

const loadTemplateContents = async () => {
  const embedded = await loadEmbeddedTemplateContents();
  if (embedded) return embedded;

  const templatesDir = resolveBundledTemplatesDir();
  const contents = new Map<string, string>();

  for (const template of BUNDLED_TEMPLATES) {
    const path = templatePath(template);
    contents.set(path, readFileSync(join(templatesDir, path), "utf8"));
  }

  return contents;
};

export const seedDefaultTemplates = async (deps: TemplatesRouteDeps, projectId: string) => {
  const contents = await loadTemplateContents();
  const seeded = [];

  for (const template of BUNDLED_TEMPLATES) {
    const existing = await deps.templateService.getByName(projectId, template.name);
    if (existing) continue;

    const path = templatePath(template);
    const content = contents.get(path);
    if (!content) {
      throw new Error(`Missing bundled template content for ${path}`);
    }
    const file = await deps.fileService.upload({
      project_id: projectId,
      file_name: `${template.name}.md`,
      file_kind: "template",
      data: Buffer.from(content),
      mime_type: "text/markdown",
    });

    const created = await deps.templateService.create({
      project_id: projectId,
      name: template.name,
      template_type: folderToType(template.folder),
      file_id: file.id,
      is_default: template.is_default,
    });

    seeded.push(created);
  }

  return seeded;
};

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { RouteDeps } from "../deps";

const BUNDLED_TEMPLATES = [
  { name: "ticket", template_type: "ticket", file_name: "ticket-template.md", is_default: true },
  { name: "proposal", template_type: "ticket", file_name: "proposal-template.md", is_default: false },
  { name: "prd", template_type: "document", file_name: "prd-template.md", is_default: true },
  { name: "adr", template_type: "document", file_name: "adr-template.md", is_default: false },
  { name: "cookbook", template_type: "document", file_name: "cookbook-template.md", is_default: false },
  { name: "review-me", template_type: "document", file_name: "review-me-template.md", is_default: false },
  { name: "lessons-learned", template_type: "document", file_name: "lessons-learned-template.md", is_default: false },
] as const;

type EmbeddedFile = Blob & { name: string };

const getEmbeddedFiles = () => {
  const files = (Bun as Record<string, unknown>).embeddedFiles;
  return Array.isArray(files) ? (files as EmbeddedFile[]) : [];
};

const getEmbeddedTemplate = (embeddedFiles: EmbeddedFile[], fileName: string) =>
  embeddedFiles.find((file) => file.name.endsWith(`/files/templates/${fileName}`));

const loadEmbeddedTemplateContents = async () => {
  const embeddedFiles = getEmbeddedFiles();
  if (embeddedFiles.length === 0) return null;

  const contents = new Map<string, string>();

  for (const template of BUNDLED_TEMPLATES) {
    const embedded = getEmbeddedTemplate(embeddedFiles, template.file_name);
    if (!embedded) return null;
    contents.set(template.file_name, await embedded.text());
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
    contents.set(template.file_name, readFileSync(join(templatesDir, template.file_name), "utf8"));
  }

  return contents;
};

export const seedDefaultTemplates = async (deps: RouteDeps, projectId: string) => {
  const contents = await loadTemplateContents();
  const seeded = [];

  for (const template of BUNDLED_TEMPLATES) {
    const existing = await deps.templatesService.getByName(projectId, template.name);
    if (existing) continue;

    const content = contents.get(template.file_name);
    if (!content) {
      throw new Error(`Missing bundled template content for ${template.file_name}`);
    }
    const file = await deps.filesService.upload({
      project_id: projectId,
      file_name: `${template.name}.md`,
      file_kind: "template",
      data: Buffer.from(content),
      mime_type: "text/markdown",
    });

    const created = await deps.templatesService.create({
      project_id: projectId,
      name: template.name,
      template_type: template.template_type,
      file_id: file.id,
      is_default: template.is_default,
    });

    seeded.push(created);
  }

  return seeded;
};

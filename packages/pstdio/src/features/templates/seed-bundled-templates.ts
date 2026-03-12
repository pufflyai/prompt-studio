import { readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveFilesRoot } from "../resolve-files-root";
import { createTemplate } from "./api/create-template";

const BUNDLED_TEMPLATES = [
  { name: "ticket", type: "ticket", file: "ticket-template.md", is_default: true },
  { name: "proposal", type: "ticket", file: "proposal-template.md", is_default: false },
  { name: "prd", type: "document", file: "prd-template.md", is_default: true },
  { name: "adr", type: "document", file: "adr-template.md", is_default: false },
  { name: "cookbook", type: "document", file: "cookbook-template.md", is_default: false },
  { name: "review-me", type: "document", file: "review-me-template.md", is_default: false },
  { name: "lessons-learned", type: "document", file: "lessons-learned-template.md", is_default: false },
];

export const seedBundledTemplates = async (baseUrl: string, projectId: string) => {
  const filesRoot = await resolveFilesRoot();
  const templatesDir = join(filesRoot, "templates");
  for (const tpl of BUNDLED_TEMPLATES) {
    const content = readFileSync(join(templatesDir, tpl.file), "utf8");
    await createTemplate(baseUrl, projectId, {
      name: tpl.name,
      template_type: tpl.type,
      content,
      is_default: tpl.is_default,
    });
  }
};

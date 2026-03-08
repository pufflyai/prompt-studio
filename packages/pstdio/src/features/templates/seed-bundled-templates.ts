import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTemplate } from "./api/create-template";

const TEMPLATES_DIR = join(import.meta.dirname, "../../../files/templates");

const BUNDLED_TEMPLATES = [
  { name: "ticket", type: "ticket", file: "ticket-template.md", is_default: true },
  { name: "proposal", type: "ticket", file: "proposal-template.md", is_default: false },
  { name: "spec", type: "document", file: "spec-template.md", is_default: true },
  { name: "adr", type: "document", file: "adr-template.md", is_default: false },
  { name: "cookbook", type: "document", file: "cookbook-template.md", is_default: false },
  { name: "review-me", type: "document", file: "review-me-template.md", is_default: false },
];

export const seedBundledTemplates = async (baseUrl: string, projectId: string) => {
  for (const tpl of BUNDLED_TEMPLATES) {
    const content = readFileSync(join(TEMPLATES_DIR, tpl.file), "utf8");
    await createTemplate(baseUrl, projectId, {
      name: tpl.name,
      template_type: tpl.type,
      content,
      is_default: tpl.is_default,
    });
  }
};

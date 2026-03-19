import { readFileSync } from "node:fs";
import { join } from "node:path";
import Mustache from "mustache";

import { resolveFilesRoot } from "../resolve-files-root";

export const renderPrompt = async (name: string, data: Record<string, unknown>) => {
  const filesRoot = await resolveFilesRoot();
  const template = readFileSync(join(filesRoot, "templates", "prompts", `${name}.txt`), "utf8");
  return Mustache.render(template, data);
};

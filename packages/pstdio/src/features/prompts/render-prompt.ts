import { readFileSync } from "node:fs";
import { join } from "node:path";
import Mustache from "mustache";

const PROMPTS_DIR = join(import.meta.dirname, "../../../files/prompts");

export const renderPrompt = (name: string, data: Record<string, unknown>) => {
  const template = readFileSync(join(PROMPTS_DIR, `${name}.txt`), "utf8");
  return Mustache.render(template, data);
};

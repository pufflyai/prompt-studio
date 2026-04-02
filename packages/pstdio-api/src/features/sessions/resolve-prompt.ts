import { readFileSync } from "node:fs";
import Mustache from "mustache";

type ResolvePromptInput = {
  prompt?: string;
  template?: string;
  vars?: Record<string, string>;
};

type ResolvePromptDeps = {
  templateService: { getByName: (projectId: string, name: string) => Promise<{ file_id: string } | null> };
  fileService: { get: (fileId: string) => Promise<{ storage_path: string } | null> };
  readFileContent?: (storagePath: string) => string;
};

class ResolvePromptError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const resolvePrompt = async (input: ResolvePromptInput, projectId: string, deps: ResolvePromptDeps) => {
  if (input.prompt && input.template) {
    throw new ResolvePromptError("--prompt and --template are mutually exclusive", 400);
  }

  if (input.prompt) {
    return input.prompt;
  }

  if (input.template) {
    const template = await deps.templateService.getByName(projectId, input.template);
    if (!template) {
      throw new ResolvePromptError(`Prompt template not found: ${input.template}`, 404);
    }

    const file = await deps.fileService.get(template.file_id);
    const readContent = deps.readFileContent ?? ((p: string) => readFileSync(p, "utf8"));
    const content = readContent(file!.storage_path);

    return Mustache.render(content, input.vars ?? {});
  }

  return "";
};

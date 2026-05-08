import Mustache from "mustache";

type ResolvePromptInput = {
  prompt?: string;
  template?: string;
  vars?: Record<string, string>;
};

type ResolvePromptDeps = {
  templateService: { getWithContent: (projectId: string, name: string) => Promise<{ content: string } | null> };
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
    const template = await deps.templateService.getWithContent(projectId, input.template);
    if (!template) {
      throw new ResolvePromptError(`Prompt template not found: ${input.template}`, 404);
    }

    return Mustache.render(template.content, input.vars ?? {});
  }

  return "";
};

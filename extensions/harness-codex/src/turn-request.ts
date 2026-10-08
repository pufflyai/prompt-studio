import { promptWithAttachmentManifest, type StartSpawnInput } from "./session-input";
export const codexTurnRequest = (input: StartSpawnInput, threadId: string, defaultModel?: string) => {
  const model = input.model ?? defaultModel;
  const effort = input.params?.model_reasoning_effort ?? "medium";
  const collaborationMode =
    input.params?.collaboration_mode && model
      ? {
          mode: input.params.collaboration_mode,
          settings: { model, reasoning_effort: effort, developer_instructions: null },
        }
      : undefined;
  return {
    threadId,
    input: [{ type: "text", text: promptWithAttachmentManifest(input.prompt, input.attachments), text_elements: [] }],
    ...(input.model ? { model: input.model } : {}),
    effort,
    ...(collaborationMode ? { collaborationMode } : {}),
  };
};

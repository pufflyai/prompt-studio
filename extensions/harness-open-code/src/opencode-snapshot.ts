import type { SessionMessageInfo } from "@opencode/client";
import type { OpencodeSessionMessage } from "./opencode-types";

// Keep native transport details at this boundary. Polling and history share this snapshot format.
export const toSessionSnapshot = (messages: SessionMessageInfo[]) => {
  const snapshot: OpencodeSessionMessage[] = [];
  for (const message of messages) {
    if (message.type === "idle") {
      const last = snapshot.at(-1);
      const error =
        message.error ??
        (message.outcome === "failed" ? { type: "execution", message: "OpenCode execution failed." } : undefined);
      if (last && "info" in last && last.info?.role === "assistant") {
        last.info.time = { ...last.info.time, completed: message.time.created };
        last.info.outcome = message.outcome;
        if (error) last.info.error = { name: error.type, data: { message: error.message } };
      } else {
        snapshot.push({
          info: {
            id: message.id,
            role: "assistant",
            time: { created: message.time.created, completed: message.time.created },
            outcome: message.outcome,
            error: error ? { name: error.type, data: { message: error.message } } : undefined,
          },
          parts: [],
        });
      }
      continue;
    }
    snapshot.push(convertMessage(message));
  }
  return snapshot;
};

const convertMessage = (message: Exclude<SessionMessageInfo, { type: "idle" }>) => {
  const info = { id: message.id, role: "system", time: { created: message.time.created } };
  switch (message.type) {
    case "assistant":
      return {
        info: {
          ...info,
          role: "assistant",
          modelID: message.model.id,
          providerID: message.model.providerID,
          tokens: message.tokens,
          error: message.error ? { name: message.error.type, data: { message: message.error.message } } : undefined,
        },
        parts: message.content.map((part) => {
          if (part.type !== "tool") return part;
          const state = part.state;
          const content = "content" in state ? state.content : undefined;
          const output = content?.flatMap((item) => (item.type === "text" ? [item.text] : [])).join("\n");
          return {
            type: "tool",
            tool: part.name,
            callID: part.id,
            state: {
              status: state.status === "streaming" ? "pending" : state.status,
              input: state.input,
              output,
              errorText: state.status === "error" ? state.error.message : undefined,
              metadata: "metadata" in state ? state.metadata : undefined,
            },
          };
        }),
      };
    case "user":
      return {
        info: { ...info, role: "user" },
        parts: [
          { type: "text", text: message.text },
          ...(message.files ?? []).map((file, index) => ({
            type: "file",
            filename: file.name,
            mime: file.mime,
            url: `data:${file.mime};base64,${file.data}`,
            fileId: Array.isArray(message.metadata?.pstdioAttachments)
              ? String(message.metadata.pstdioAttachments[index])
              : undefined,
          })),
        ],
      };
    case "compaction":
      return {
        info,
        parts:
          message.status === "failed"
            ? [{ type: "error", message: message.error.message }]
            : [{ type: "text", text: message.summary }],
      };
    case "shell":
      return {
        info: { ...info, role: "assistant" },
        parts: [
          {
            type: "tool",
            tool: "bash",
            callID: message.shellID,
            state: { status: message.status, input: { command: message.command }, output: message.output },
          },
        ],
      };
    default:
      return { info, parts: "text" in message ? [{ type: "text", text: message.text }] : [] };
  }
};

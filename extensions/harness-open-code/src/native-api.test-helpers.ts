import type { SessionMessageInfo } from "@opencode/client";
import type { OpencodeSessionMessage, OpencodeSessionMessagePart } from "./opencode-types";

// Encode readable scenario fixtures as native OpenCode 2 HTTP responses.
export const nativeMessagesResponse = (messages: OpencodeSessionMessage[]) => {
  const data: SessionMessageInfo[] = [];
  for (const [index, message] of messages.entries()) {
    const info = "info" in message ? message.info : undefined;
    const role = info?.role ?? ("role" in message ? message.role : "assistant");
    const parts = messageParts(message);
    const id = info?.id ?? `msg_${index}`;
    const time = { created: info?.time?.created ?? 1 };
    if (role === "user") {
      data.push(nativeUser(id, time, parts));
      continue;
    }
    data.push({
      type: "assistant",
      id,
      time,
      agent: "build",
      model: { id: info?.modelID ?? "test", providerID: info?.providerID ?? "local" },
      content: parts.flatMap<unknown>((part) => {
        if (part.type === "text" || part.type === "reasoning") return [{ type: part.type, text: part.text ?? "" }];
        if (part.type !== "tool") return [];
        return [
          {
            type: "tool",
            id: part.callID ?? "call_test",
            name: part.tool ?? "bash",
            time,
            state: {
              status: part.state?.status ?? "running",
              input: part.state?.input ?? {},
              metadata: part.state?.metadata,
              content: [{ type: "text", text: String(part.state?.output ?? "") }],
              error: { type: "tool", message: part.state?.errorText ?? "tool failed" },
            },
          },
        ];
      }) as Extract<SessionMessageInfo, { type: "assistant" }>["content"],
      error: info?.error
        ? { type: info.error.name ?? "api", message: info.error.data?.message ?? "failed" }
        : undefined,
    });
    if (info?.time?.completed !== undefined || ("role" in message && role === "assistant")) {
      data.push({ type: "idle", id: `msg_idle_${index}`, time, outcome: "succeeded" });
    }
  }
  return Response.json({ data, cursor: {} });
};

export const acceptedPrompt = () => Response.json({ data: { id: "msg_prompt" } });
export const emptyMessages = () => Response.json({ data: [], cursor: {} });

const messageParts = (message: OpencodeSessionMessage) => {
  if ("parts" in message) return message.parts ?? [];
  if ("content" in message) return message.content;
  return [];
};

const nativeUser = (id: string, time: { created: number }, parts: OpencodeSessionMessagePart[]) => {
  return {
    type: "user" as const,
    id,
    time,
    metadata: { pstdioAttachments: parts.filter((part) => part.type === "file").map((part) => part.fileId ?? "") },
    text: parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n"),
    files: parts
      .filter((part) => part.type === "file")
      .map((part) => ({
        name: part.filename,
        mime: part.mime ?? "text/plain",
        data: part.url?.split(",")[1] ?? "",
        source: { type: "inline" as const },
      })),
  };
};

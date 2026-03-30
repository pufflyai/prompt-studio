import type { SessionMessage } from "pstdio-agents";

type SummaryOptions = {
  format: "brief" | "detailed";
  role: "assistant" | "all";
};

const extractText = (message: SessionMessage) =>
  message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("\n");

export const composeSummary = (messages: SessionMessage[], options: SummaryOptions) => {
  const filtered = options.role === "assistant" ? messages.filter((m) => m.role === "assistant") : messages;

  const lines: string[] = [];

  for (const message of filtered) {
    const text = extractText(message).trim();
    if (!text) continue;

    if (options.format === "detailed") {
      lines.push(`[${message.role}]\n${text}`);
    } else {
      lines.push(text);
    }
  }

  return lines.join("\n\n");
};

export type CodexUsage = {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
};

export type CodexThreadItem = {
  id: string;
  type: string;
  text?: string;
  command?: string;
  aggregated_output?: string;
  exit_code?: number | null;
  status?: string;
  changes?: unknown;
  server?: string;
  tool?: string;
  query?: string;
  items?: unknown;
  message?: string;
};

export type CodexThreadEvent =
  | { type: "thread.started"; thread_id: string }
  | { type: "turn.started" }
  | { type: "turn.completed"; usage?: CodexUsage }
  | { type: "turn.failed"; error?: { message?: string } }
  | { type: "item.started" | "item.updated" | "item.completed"; item: CodexThreadItem }
  | { type: "error"; message?: string };

export const parseThreadEvent = (line: string): CodexThreadEvent | null => {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (!parsed || typeof parsed.type !== "string") return null;
    return parsed as CodexThreadEvent;
  } catch {
    return null;
  }
};

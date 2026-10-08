export type CodexUsage = {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
};

export type CodexThreadItem = {
  id: string;
  type: string;
  turnId?: string;
  text?: string;
  command?: string | string[];
  aggregated_output?: string;
  exit_code?: number | null;
  status?: string;
  changes?: unknown;
  server?: string;
  tool?: string;
  query?: string;
  items?: unknown;
  message?: string;
  input?: unknown;
  path?: string;
  output?: unknown;
  metadata?: Record<string, unknown>;
};

import type { ToolResultSummary } from "@pstdio/sdk/extensions";
export type OpencodeSessionMessagePart = {
  type: string;
  text?: string;
  tool?: string;
  callID?: string;
  state?: {
    status?: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
    error?: string;
    metadata?: unknown;
    resultSummary?: ToolResultSummary;
  };
  reason?: string;
  snapshot?: string;
  cost?: number;
  tokens?: unknown;
  hash?: string;
  files?: unknown;
  errorType?: string;
  message?: string;
  mime?: string;
  fileId?: string;
  filename?: string;
  url?: string;
};

export type OpencodeSessionMessageInfo = {
  id?: string;
  role?: string;
  sessionID?: string;
  modelID?: string;
  providerID?: string;
  time?: {
    created?: number;
    completed?: number;
  };
  finish?: string;
  error?: {
    name?: string;
    data?: { message?: string };
  };
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
};

export type OpencodeSessionMessageParts = {
  info?: OpencodeSessionMessageInfo;
  parts?: OpencodeSessionMessagePart[];
};

export type OpencodeSessionMessageContent = {
  role: string;
  content: OpencodeSessionMessagePart[];
};

export type OpencodeSessionMessage = OpencodeSessionMessageContent | OpencodeSessionMessageParts;

import type { SessionMessage } from "./session-messages";

export type JsonPatch = {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
};

export type HarnessEventSink = {
  push(patch: JsonPatch): void;
  getMessages(): readonly SessionMessage[];
};

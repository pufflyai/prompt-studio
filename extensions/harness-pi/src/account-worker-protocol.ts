import type {
  HarnessAuthentication,
  HarnessAuthenticationInput,
  HarnessAuthenticationPrompt,
} from "@pstdio/sdk/extensions";
export type AccountWorkerInput =
  | { type: "status"; model?: string }
  | { type: "authenticate"; input: HarnessAuthenticationInput };
export type AccountWorkerMessage =
  | { type: "state"; value: HarnessAuthentication }
  | { type: "prompt"; prompt: HarnessAuthenticationPrompt; id?: number }
  | { type: "completed" }
  | { type: "error"; message: string };

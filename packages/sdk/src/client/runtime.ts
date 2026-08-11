import type { RequestFn } from "./request";

export type RuntimeClient = {
  provisionBrowserSession: () => Promise<void>;
};

export const createRuntimeClient = (request: RequestFn): RuntimeClient => ({
  provisionBrowserSession: () => request<void>("/runtime/browser-session", { method: "POST" }),
});

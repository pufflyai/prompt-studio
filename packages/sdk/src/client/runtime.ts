import type { RequestFn } from "./request";

export type RuntimeClient = {
  /** Creates a single-use browser login link. Needs the runtime token. */
  createBrowserLogin: () => Promise<{ url: string }>;
};

export const createRuntimeClient = (request: RequestFn): RuntimeClient => ({
  createBrowserLogin: () => request<{ url: string }>("/runtime/browser-login", { method: "POST" }),
});

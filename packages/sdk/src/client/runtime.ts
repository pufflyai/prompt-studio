import type { RequestFn } from "./request";

export type RuntimeClient = {
  ready: () => Promise<import("pstdio-api-contracts").RuntimeReadyResponse>;
  claimBrowserSession: (code: string) => Promise<{ secret: string }>;
  environment: () => Promise<EnvironmentIdentity>;
  resolveTarget: (target: EnvironmentTarget) => Promise<Workspace>;
  /** Creates a single-use browser login link. Needs the runtime token. */
  createBrowserLogin: () => Promise<{ url: string }>;
};

export const createRuntimeClient = (request: RequestFn): RuntimeClient => ({
  ready: () => request("/runtime/ready"),
  claimBrowserSession: (code) => request("/runtime/browser-session", { method: "POST", body: { code } }),
  environment: () => request("/v1/environment"),
  resolveTarget: (body) => request("/v1/environment/resolve-target", { method: "POST", body }),
  createBrowserLogin: () => request<{ url: string }>("/runtime/browser-login", { method: "POST" }),
});

import type { EnvironmentIdentity, EnvironmentTarget } from "pstdio-api-contracts";
import type { Workspace } from "../resources";

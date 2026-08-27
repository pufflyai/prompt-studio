import type { ExtensionConnectionContribution } from "pstdio-api-contracts/extension-kernel";
import { createExtensionConnectionService } from "./extension-connection-service";

export const connection = {
  id: "connection-record-1",
  project_id: "project-1",
  extension_id: "pstdio.remote",
  contribution_id: "control-plane",
  base_url: "https://control.example.test/api/",
  auth_type: "bearer" as const,
  auth_header_name: null,
  secret_ref: "secret-1",
  config_json: {},
  last_check_json: null,
  created_at: "2026-08-26T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
};

export const contribution = {
  id: "control-plane",
  ref: { kind: "connection" as const, id: "control-plane" },
  label: "Control plane",
  transport: "http" as const,
  auth: { type: "bearer" as const },
  allowedMethods: ["GET", "POST"] as const,
  allowedPathPrefixes: ["/v1/workspaces"],
  check: { method: "GET" as const, path: "/v1/workspaces/health" },
};

export const createConnectionTestService = (
  fetchFn: typeof fetch,
  contributionOverride: ExtensionConnectionContribution = contribution,
) =>
  createExtensionConnectionService({
    connectionsDBService: {
      get: async () => connection,
      recordCheck: async () => {},
    } as never,
    secretStore: {
      get: async () => "credential-canary",
      set: async () => "secret-1",
      delete: async () => {},
    },
    getContribution: async () => contributionOverride,
    fetch: fetchFn,
  });

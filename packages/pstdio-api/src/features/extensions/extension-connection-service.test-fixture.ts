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
  credential_project_id: "project-1",
  config_json: {},
  last_check_json: null,
  created_at: "2026-08-26T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
};

// Transport/failure unit cases supply connection rows directly. Ownership behavior is
// exercised separately with the real database and secret store.
export const credentialMethods = {
  credentials: {
    get: async (key: { projectId: string | null }) =>
      key.projectId === connection.project_id
        ? {
            ...connection,
            provider: new URL(connection.base_url).origin,
            project_id: connection.project_id,
            expires_at: null,
          }
        : null,
    isReferenced: async () => false,
    projectRefs: async () => [connection.secret_ref],
    removeProjectExtension: async () => [],
    projectOwners: async function* () {},
    remove: async () => null,
  },
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
      ...credentialMethods,
      get: async () => connection,
      recordCheck: async () => {},
    } as never,
    secretStore: {
      get: async () => "credential-canary",
      set: async () => "secret-1",
      delete: async () => {},
      listRefs: async () => ["secret-1"],
    },
    getContribution: async () => contributionOverride,
    fetch: fetchFn,
  });

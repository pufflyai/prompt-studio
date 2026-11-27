import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { DeclaredExtensionConnection } from "pstdio-api-contracts/extension-kernel";
import type { createExtensionConnectionsDBService } from "pstdio-db";
import type { ConnectionSecretStore } from "./connection-secret-store";

export type ConnectionKey = {
  projectId: string;
  extensionId: string;
  connectionId: string;
};

export type ConnectionRequestAudit = ConnectionKey & {
  method: string;
  path: string;
  ok: boolean;
  status: number | null;
  error: string | null;
  durationMs: number;
  responseBytes: number;
};

export type ConnectionCleanupContext = { operation: string; secretRef?: string } & Partial<ConnectionKey>;

export type ExtensionConnectionServiceDeps = {
  connectionsDBService: ReturnType<typeof createExtensionConnectionsDBService>;
  secretStore: ConnectionSecretStore;
  getContribution: (input: ConnectionKey) => Promise<DeclaredExtensionConnection | null | undefined>;
  isExtensionInstalled?: (projectId: string | null, extensionId: string) => Promise<boolean>;
  onCleanupError?: (error: unknown, context: ConnectionCleanupContext) => void;
  fetch?: typeof fetch;
  oauthOwner?: () => Promise<string>;
  onOAuthGrantChanged?: (input: ConnectionKey) => void;
  now?: () => number;
  onRequestComplete?: (audit: ConnectionRequestAudit) => void | Promise<void>;
};

export type StoredConnection = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createExtensionConnectionsDBService>["get"]>>
>;

export const toConnectionRecord = (stored: StoredConnection) => ({
  id: stored.id,
  ...(stored.project_id === null ? { scope: "global" as const } : {}),
  extensionId: stored.extension_id,
  connectionId: stored.contribution_id,
  baseUrl: stored.base_url,
  authType: stored.auth_type,
  configured: Boolean(stored.secret_ref),
  lastCheck: stored.last_check_json,
  updatedAt: stored.updated_at,
});

export const connectionKey = (input: ConnectionKey, scope?: "project" | "global") => ({
  projectId: scope === "global" ? null : input.projectId,
  extensionId: canonicalExtensionId(input.extensionId),
  contributionId: input.connectionId,
});

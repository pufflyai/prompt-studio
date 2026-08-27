import type { ExtensionConnectionContribution } from "pstdio-api-contracts/extension-kernel";
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

export type ExtensionConnectionServiceDeps = {
  connectionsDBService: ReturnType<typeof createExtensionConnectionsDBService>;
  secretStore: ConnectionSecretStore;
  getContribution: (input: ConnectionKey) => Promise<ExtensionConnectionContribution | null | undefined>;
  isExtensionInstalled?: (projectId: string, extensionId: string) => Promise<boolean>;
  onCleanupError?: (error: unknown, context: { operation: string; secretRef?: string }) => void;
  fetch?: typeof fetch;
  onRequestComplete?: (audit: ConnectionRequestAudit) => void | Promise<void>;
};

export type StoredConnection = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createExtensionConnectionsDBService>["get"]>>
>;

export const toConnectionRecord = (stored: StoredConnection) => ({
  id: stored.id,
  extensionId: stored.extension_id,
  connectionId: stored.contribution_id,
  baseUrl: stored.base_url,
  authType: stored.auth_type,
  configured: Boolean(stored.secret_ref),
  lastCheck: stored.last_check_json,
  updatedAt: stored.updated_at,
});

export const connectionKey = (input: ConnectionKey) => ({
  projectId: input.projectId,
  extensionId: input.extensionId,
  contributionId: input.connectionId,
});

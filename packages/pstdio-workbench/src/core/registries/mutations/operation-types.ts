import type { ResourceRef } from "@pstdio/sdk/extensions";

export type OperationStatus = "queued" | "writing" | "reconciling" | "rejected" | "unknown" | "unconfirmed";
export type OperationFailure = "rejected" | "unknown";

export type OperationCheck<T> =
  | { status: "confirmed"; result: T }
  | { status: "rejected"; error: unknown }
  | { status: "unknown" };

export interface OperationSourceCommand {
  id: string;
  args?: unknown;
}

export type OperationRecoverySource = "cloud-project-picker";
export type ProjectRecoveryAvailability = (projectId: string, source?: OperationRecoverySource) => boolean | undefined;

export interface OperationInput<T> {
  projectId?: string;
  subjects: readonly string[];
  domain: string;
  intent?: unknown;
  title: string;
  source?: ResourceRef;
  sourceCommand?: OperationSourceCommand;
  recoverySource?: OperationRecoverySource;
  draft?: unknown;
  describeRecovery?(): string;
  recoveryFiles?(): readonly File[];
  releaseOnDiscard?: boolean;
  showPending?: true;
  onDiscard?(): void;
  /** Preserve a submitted draft without dispatching its write. */
  unsentError?: Error;
  /** Retain only edits that differ from an already reconciled write. */
  retainedAfterReconcile?(draft: unknown): { draft: unknown; error: Error } | undefined;
  write(signal: AbortSignal): T | Promise<T>;
  reconcile?(result: T, signal: AbortSignal): void | Promise<void>;
  onReconciled?(): void;
  reconcileRejection?(error: unknown, signal: AbortSignal): void | Promise<void>;
  originatingRead?: Pick<OperationRead, "key" | "refresh">;
  classify?(error: unknown): OperationFailure;
  /** Only provide this when the read can prove the outcome of this particular write. */
  check?(signal: AbortSignal): Promise<OperationCheck<T>>;
}

export interface OperationPreview {
  id: symbol;
  projectId?: string;
  subjects: readonly string[];
  title: string;
  domain: string;
  intent?: unknown;
  status: OperationStatus;
  startedAt: number;
  showPending?: true;
}

export interface OperationRecovery {
  id: symbol;
  subjects: readonly string[];
  domain: string;
  projectId?: string;
  title: string;
  source?: ResourceRef;
  sourceCommand?: OperationSourceCommand;
  draft?: unknown;
  description?: string;
  files?: readonly File[];
  status: OperationFailure | "unconfirmed";
  error: unknown;
  dismissed: boolean;
  canCheck: boolean;
  retired?: true;
  projectUnavailable?: true;
  acknowledged?: true;
}

export interface OperationSnapshot {
  pending: readonly OperationPreview[];
  recovery: readonly OperationRecovery[];
}

export interface OperationRead {
  key: string;
  matches(operation: OperationPreview): boolean;
  refresh(signal: AbortSignal): void | Promise<void>;
}

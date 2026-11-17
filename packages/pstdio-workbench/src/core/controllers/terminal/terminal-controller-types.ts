import type {
  TerminalSessionAdapter,
  TerminalSessionError,
  TerminalSessionExit,
  TerminalSessionRequest,
  TerminalViewBinding,
} from "@pstdio/sdk/api";
import type { WorkbenchStore } from "../../shared/store/workbench-store";

// The renderer-side terminal contract is shared through the public SDK. Core keeps its
// Workbench* names as aliases so its API does not depend on @pstdio/ui.
export type WorkbenchTerminalSessionRequest = TerminalSessionRequest;
export type WorkbenchTerminalSessionExit = TerminalSessionExit;
export type WorkbenchTerminalSessionError = TerminalSessionError;
export type WorkbenchTerminalSessionAdapter = TerminalSessionAdapter & {
  /**
   * Releases the adapter without ending its session. Hosts whose sessions outlive the workbench
   * implement it; disposing the workbench then detaches the session instead of killing it.
   */
  detach?(): void;
};

// Host-injected session factory. Production hosts back this with a PTY transport;
// the testbench and stories inject a deterministic scripted opener.
export type WorkbenchTerminalSessionOpener = (
  request: WorkbenchTerminalSessionRequest,
  view?: TerminalViewBinding,
  signal?: AbortSignal,
  /** Stable key of the placement that shows the session; a recreated workbench passes the same key. */
  binding?: string,
) => Promise<WorkbenchTerminalSessionAdapter>;

export type WorkbenchTerminalSessionStatus = "running" | "exited" | "killed";

export interface WorkbenchTerminalSessionModel {
  id: string;
  title: string;
  status: WorkbenchTerminalSessionStatus;
  exit?: WorkbenchTerminalSessionExit;
}

export interface WorkbenchTerminalState {
  sessionsById: Record<string, WorkbenchTerminalSessionModel>;
}

export interface WorkbenchTerminalSessionSink {
  onData?(chunk: Uint8Array): void;
  onExit?(exit: WorkbenchTerminalSessionExit): void;
  onError?(error: WorkbenchTerminalSessionError): void;
}

export interface WorkbenchTerminalController {
  store: WorkbenchStore<WorkbenchTerminalState>;
  /** True once the host injected a session opener. */
  isAvailable(): boolean;
  setSessionOpener(opener: WorkbenchTerminalSessionOpener | null): void;
  /** Opens a session; the live adapter stays host-side and only the id is returned. */
  open(input: {
    bindingId?: string;
    ownerId?: string;
    view?: TerminalViewBinding;
    request: WorkbenchTerminalSessionRequest;
    title?: string;
  }): Promise<{ sessionId: string }>;
  write(input: { sessionId: string; data: string | Uint8Array }): void;
  resize(input: { sessionId: string; cols: number; rows: number }): void;
  kill(input: { sessionId: string; signal?: string }): Promise<void>;
  killBinding(bindingId: string, ownerId?: string): Promise<void>;
  /** Observe admission/session ownership, including failed openings that publish no session row. */
  onDidChangeOwnership(listener: () => void): () => void;
  /** Whether a contribution still owns an admitted/pending session or retained exited presentation. */
  hasOwner(ownerId: string): boolean;
  /** Release every live or pending session of a contribution, including hidden presentations. */
  killOwner(ownerId: string): Promise<void>;
  subscribe(sessionId: string, sink: WorkbenchTerminalSessionSink): () => void;
  getSession(sessionId: string): WorkbenchTerminalSessionModel | undefined;
  listSessions(): WorkbenchTerminalSessionModel[];
  /** Detaches or kills every live session. Called when the owning workbench is torn down. */
  dispose(): Promise<void>;
}

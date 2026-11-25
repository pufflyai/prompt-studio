/** Starts a host-owned child with writable stdin and streamed output. */
export interface ProcessSpawnInput {
  command: string[];
  cwd?: string;
  env?: Record<string, string>;
  /** Defaults to the invocation's workspace. A session operation passes its own. */
  workspaceId?: string;
  /**
   * `call` (default) ends with the command, hook or native operation that started it. `extension`
   * lasts for the enabled source generation in this project and ends on disable, reload or shutdown.
   */
  lifetime?: "call" | "extension";
}

export interface ProcessExit {
  code: number | null;
  signal: string | null;
}

export type ProcessEvent = { type: "stdout" | "stderr"; data: Uint8Array } | { type: "exit"; exit: ProcessExit };

/** A child owned by the host. It exposes no OS pid. */
export interface ProcessHandle {
  id: string;
  /** Settles once the child runs; rejects with a coded error when it cannot start. */
  started: Promise<void>;
  /**
   * Reports the direct child's exit status, including startup failure, even while output remains unread.
   * Await `kill()` to confirm cleanup of the child and its descendants.
   */
  exited: Promise<ProcessExit>;
  /** Writes to stdin in call order, waiting for the pipe to accept the data. */
  write(data: string | Uint8Array): Promise<void>;
  /** Closes stdin after earlier writes. Idempotent; later writes reject. */
  end(): Promise<void>;
  /** Stops the child and its descendants. Idempotent; resolves once cleanup is done. */
  kill(signal?: "SIGTERM" | "SIGINT" | "SIGKILL"): Promise<void>;
  /** Single-consumer output. `exit` is always the last event. */
  events(): AsyncIterable<ProcessEvent>;
}

export type ProcessSpawnErrorCode =
  | "process_command_not_found"
  | "process_target_unsupported"
  | "process_target_unavailable"
  | "process_owner_closed";

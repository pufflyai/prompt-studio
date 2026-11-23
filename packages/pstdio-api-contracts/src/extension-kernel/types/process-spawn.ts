/** Starts a host-owned child with writable stdin and streamed output. */
export interface ProcessSpawnInput {
  command: string[];
  /**
   * A path on the selected target. Relative paths resolve against the target workspace's root.
   * It never changes which target runs the child.
   */
  cwd?: string;
  /** Added to the host's safe base environment. The host never passes its own environment through. */
  env?: Record<string, string>;
  /**
   * Host variables to pass to this child, by name, as for `run`. Each name must be listed in the
   * package's `pstdio.processEnvironment` and allowed for this project and source. The host removes
   * the values from the output it streams back. Local targets only.
   */
  envFromHost?: string[];
  /**
   * The workspace that runs the child. It must belong to the calling project. Defaults to the
   * invocation's workspace; a harness session operation passes its own. A remote workspace runs
   * the child through its provider's `spawn`, never on this device.
   */
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
  /**
   * Identifies this handle to the code that holds it, for example as a map key. It is not an OS
   * pid and no host API accepts it. In the process runtime the worker creates its own id, so it
   * differs from the id of the host's handle.
   */
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

/** Reads files on a workspace's own target, such as an agent's native history. */
export interface ExtensionTargetFilesApi {
  /**
   * Reads a UTF-8 text file. `path` is native to the target: `~` expands to the target's home,
   * a relative path resolves against the workspace root. A remote workspace whose provider has
   * no `readText` rejects with `target_file_unsupported`; the host never reads a local file instead.
   */
  readText(input: { workspaceId: string; path: string }): Promise<string>;
}

export type TargetFileErrorCode = "target_file_unsupported" | "target_file_unavailable";

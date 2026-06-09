import { existsSync } from "node:fs";
import type {
  ExtensionLoggerApi,
  ExtensionTerminalApi,
  TerminalEvent,
  TerminalSessionHandle,
  TerminalSessionRequest,
} from "@pstdio/sdk/extensions";

// Single-consumer async queue bridging Bun.Terminal callbacks to events().
// `exit` is pushed last, then close() ends iteration.
const createEventQueue = () => {
  const buffer: TerminalEvent[] = [];
  let closed = false;
  let wake: (() => void) | null = null;

  const notify = () => {
    const resume = wake;
    wake = null;
    resume?.();
  };

  return {
    push(event: TerminalEvent) {
      buffer.push(event);
      notify();
    },
    close() {
      closed = true;
      notify();
    },
    async *drain() {
      while (true) {
        const next = buffer.shift();
        if (next) {
          yield next;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };
};

// Resolves the shell to spawn when the request omits an explicit command.
// POSIX: $SHELL, then /bin/zsh -> /bin/bash -> /bin/sh. Windows: %ComSpec%, then powershell.exe.
const resolveShellCommand = () => {
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec;
    return [comspec && existsSync(comspec) ? comspec : "powershell.exe"];
  }
  const candidates = [process.env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"].filter(Boolean) as string[];
  const shell = candidates.find((candidate) => existsSync(candidate));
  if (!shell) throw new Error("TerminalShellNotFound: no shell binary resolved on this host");
  return [shell];
};

const resolveCommand = (command: TerminalSessionRequest["command"]) =>
  command && command.length > 0 ? command : resolveShellCommand();

interface TerminalSession {
  pid: number;
  kill(signal?: NodeJS.Signals): Promise<void>;
}

/**
 * Host PTY supervisor built on Bun's native terminal API (`new Bun.Terminal` +
 * `Bun.spawn(cmd, { terminal })`). Owns a per-supervisor session registry; `dispose`
 * force-kills every live session. Logs lifecycle only — never PTY content.
 */
export const createTerminalSupervisor = (input: { logger: ExtensionLoggerApi }) => {
  const { logger } = input;
  const sessions = new Map<string, TerminalSession>();

  const api: ExtensionTerminalApi = {
    openSession(request) {
      const command = resolveCommand(request.command);
      const id = crypto.randomUUID();
      const queue = createEventQueue();

      const terminal = new Bun.Terminal({
        cols: request.cols,
        rows: request.rows,
        data: (_terminal, chunk) => queue.push({ kind: "data", chunk: new Uint8Array(chunk) }),
      });

      const child = Bun.spawn(command, {
        cwd: request.cwd,
        env: request.env ? { ...process.env, ...request.env } : process.env,
        terminal,
      });

      void child.exited.then((code) => {
        sessions.delete(id);
        logger.info("terminal session exited", { id, code });
        queue.push({ kind: "exit", code, signal: child.signalCode });
        queue.close();
        terminal.close();
      });

      const kill = async (signal?: NodeJS.Signals) => {
        logger.info("terminal session kill", { id, signal: signal ?? null });
        child.kill(signal);
        await child.exited;
      };

      let consumed = false;
      const handle: TerminalSessionHandle = {
        id,
        write: (data) => {
          terminal.write(data);
        },
        resize: (cols, rows) => {
          terminal.resize(cols, rows);
        },
        kill,
        events: () => {
          if (consumed) throw new Error(`Terminal session ${id} already has an active iterator`);
          consumed = true;
          return queue.drain();
        },
      };

      sessions.set(id, { pid: child.pid, kill });
      logger.info("terminal session opened", { id, pid: child.pid });
      return handle;
    },
  };

  const dispose = async () => {
    await Promise.all([...sessions.values()].map((session) => session.kill("SIGKILL")));
    sessions.clear();
  };

  return { api, dispose };
};

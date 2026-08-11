import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import type {
  ExtensionLoggerApi,
  ExtensionTerminalApi,
  TerminalEvent,
  TerminalSessionHandle,
  TerminalSessionRequest,
} from "pstdio-api-contracts/extension-kernel";
import { createExtensionProcessEnvironment } from "pstdio-extensions";

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

const TITLE_POLL_INTERVAL_MS = 1000;

// The PTY tab title tracks the foreground process like VSCode. On Linux the
// controlling terminal's foreground process group leader (`tpgid` in
// /proc/<pid>/stat) is the running program; its `comm` is the name to show.
// Elsewhere (or when /proc is unavailable) we keep the launched command name.
const readForegroundProcessName = (shellPid: number, fallback: string) => {
  try {
    const stat = readFileSync(`/proc/${shellPid}/stat`, "utf8");
    // Fields after the parenthesised comm: state ppid pgrp session tty_nr tpgid ...
    const fields = stat
      .slice(stat.lastIndexOf(")") + 1)
      .trim()
      .split(/\s+/);
    const foregroundGroupId = Number.parseInt(fields[5] ?? "", 10);
    if (!Number.isInteger(foregroundGroupId) || foregroundGroupId <= 0) return fallback;
    const name = readFileSync(`/proc/${foregroundGroupId}/comm`, "utf8").trim();
    return name.length > 0 ? name : fallback;
  } catch {
    return fallback;
  }
};

const createTerminalEnv = (requestEnv: TerminalSessionRequest["env"]) => {
  const env = createExtensionProcessEnvironment(process.env, requestEnv);
  const hasExplicitTerm = Boolean(requestEnv?.TERM);
  const hasExplicitColorTerm = Boolean(requestEnv?.COLORTERM);

  if (!hasExplicitTerm && (!env.TERM || env.TERM === "dumb")) env.TERM = "xterm-256color";
  if (!hasExplicitColorTerm && !env.COLORTERM) env.COLORTERM = "truecolor";

  return env;
};

interface TerminalSession {
  label: string;
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
      const env = createTerminalEnv(request.env);
      const id = crypto.randomUUID();
      const queue = createEventQueue();

      const child = Bun.spawn(command, {
        cwd: request.cwd,
        env,
        terminal: {
          cols: request.cols,
          rows: request.rows,
          name: env.TERM ?? "xterm-256color",
          data: (_terminal, chunk) => queue.push({ kind: "data", chunk: new Uint8Array(chunk) }),
        },
      });
      const terminal = child.terminal;
      if (!terminal) {
        child.kill();
        throw new Error("TerminalSessionOpenFailed: PTY was not attached");
      }

      const fallbackTitle = basename(command[0]);
      let lastTitle = "";
      const publishTitle = (title: string) => {
        if (title === lastTitle) return;
        lastTitle = title;
        queue.push({ kind: "title", title });
      };
      // Publish the launched process name right away — deterministic and free of
      // the PTY foreground-group race at spawn — then track the live foreground.
      publishTitle(fallbackTitle);
      const titlePoll = setInterval(
        () => publishTitle(readForegroundProcessName(child.pid, fallbackTitle)),
        TITLE_POLL_INTERVAL_MS,
      );

      void child.exited.then((code) => {
        clearInterval(titlePoll);
        sessions.delete(id);
        logger.info("terminal session exited", { id, code });
        queue.push({ kind: "exit", code, signal: child.signalCode });
        queue.close();
        terminal.close();
      });

      const kill = async (signal: NodeJS.Signals = "SIGTERM") => {
        logger.info("terminal session kill", { id, signal });
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

      sessions.set(id, { label: fallbackTitle, pid: child.pid, kill });
      logger.info("terminal session opened", { id, pid: child.pid });
      return handle;
    },
  };

  const dispose = async () => {
    await Promise.all([...sessions.values()].map((session) => session.kill("SIGKILL")));
    sessions.clear();
  };

  const activity = () => [...sessions].map(([id, session]) => ({ id, label: session.label }));

  return { activity, api, dispose };
};

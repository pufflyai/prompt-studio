import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionLoggerApi, TerminalEvent } from "pstdio-api-contracts/extension-kernel";
import { createTerminalSupervisor } from "./extension-terminal-runtime";

interface LogRecord {
  message: string;
  metadata?: Record<string, unknown>;
}

const createRecordingLogger = () => {
  const records: LogRecord[] = [];
  const record = (message: string, metadata?: Record<string, unknown>) => records.push({ message, metadata });
  const logger: ExtensionLoggerApi = { info: record, warn: record, error: record };
  return { logger, records };
};

const decode = (events: TerminalEvent[]) =>
  events
    .filter((event): event is Extract<TerminalEvent, { kind: "data" }> => event.kind === "data")
    .map((event) => new TextDecoder().decode(event.chunk))
    .join("");

describe("terminal supervisor", () => {
  test("reports a missing working directory before spawning the shell", () => {
    const { logger } = createRecordingLogger();
    const supervisor = createTerminalSupervisor({ logger });
    const missingDirectory = join(tmpdir(), `pstdio-missing-terminal-cwd-${crypto.randomUUID()}`);

    expect(() =>
      supervisor.api.openSession({ command: ["/bin/sh"], cwd: missingDirectory, cols: 80, rows: 24 }),
    ).toThrow(`Terminal working directory does not exist: ${missingDirectory}`);
  });

  test("provides terminal metadata when the host environment omits it", async () => {
    const { logger } = createRecordingLogger();
    const supervisor = createTerminalSupervisor({ logger });
    const previousTerm = process.env.TERM;
    const previousColorTerm = process.env.COLORTERM;

    delete process.env.TERM;
    delete process.env.COLORTERM;

    try {
      const handle = supervisor.api.openSession({
        command: ["/bin/sh", "-lc", 'printf \'%s|%s\\n\' "$TERM" "$COLORTERM"'],
        cols: 80,
        rows: 24,
      });

      const events: TerminalEvent[] = [];
      for await (const event of handle.events()) events.push(event);

      expect(decode(events)).toContain("xterm-256color|truecolor");
    } finally {
      if (previousTerm === undefined) {
        delete process.env.TERM;
      } else {
        process.env.TERM = previousTerm;
      }
      if (previousColorTerm === undefined) {
        delete process.env.COLORTERM;
      } else {
        process.env.COLORTERM = previousColorTerm;
      }
      await supervisor.dispose();
    }
  });

  test("opens a session, echoes input, and exits cleanly", async () => {
    const { logger, records } = createRecordingLogger();
    const supervisor = createTerminalSupervisor({ logger });
    const handle = supervisor.api.openSession({ command: ["/bin/sh"], cols: 80, rows: 24 });

    const events: TerminalEvent[] = [];
    const consumed = (async () => {
      for await (const event of handle.events()) events.push(event);
    })();

    handle.write("echo hi-marker\n");
    handle.write("exit\n");
    await consumed;

    expect(decode(events)).toContain("hi-marker");
    // On open the session reports its launched process name (deterministic across
    // platforms) so the UI can title the tab; the live foreground is tracked after.
    expect(events.some((event) => event.kind === "title" && event.title === "sh")).toBe(true);
    const last = events.at(-1);
    expect(last?.kind).toBe("exit");
    expect(last).toMatchObject({ kind: "exit", code: 0 });

    // Lifecycle is logged, but PTY content never is.
    expect(records.some((entry) => entry.message === "terminal session opened")).toBe(true);
    expect(JSON.stringify(records)).not.toContain("hi-marker");
  });

  test("opens interactive bash with job control", async () => {
    const { logger } = createRecordingLogger();
    const supervisor = createTerminalSupervisor({ logger });
    const handle = supervisor.api.openSession({ command: ["/bin/bash"], cols: 80, rows: 24 });

    const events: TerminalEvent[] = [];
    const consumed = (async () => {
      for await (const event of handle.events()) events.push(event);
    })();

    handle.write("exit\n");
    await consumed;

    const output = decode(events);
    expect(output).not.toContain("cannot set terminal process group");
    expect(output).not.toContain("no job control in this shell");
  });

  test("propagates resize to the child PTY geometry", async () => {
    const { logger } = createRecordingLogger();
    const supervisor = createTerminalSupervisor({ logger });
    const handle = supervisor.api.openSession({ command: ["/bin/sh"], cols: 80, rows: 24 });

    const events: TerminalEvent[] = [];
    const consumed = (async () => {
      for await (const event of handle.events()) events.push(event);
    })();

    handle.resize(120, 40);
    handle.write("stty size\n");
    handle.write("exit\n");
    await consumed;

    // `stty size` reports "rows cols".
    expect(decode(events)).toContain("40 120");
  });

  test("dispose force-kills live session children", async () => {
    const { logger, records } = createRecordingLogger();
    const supervisor = createTerminalSupervisor({ logger });
    const handle = supervisor.api.openSession({ command: ["/bin/sh"], cols: 80, rows: 24 });
    // Drain events so the exit settles cleanly after the kill.
    void (async () => {
      for await (const _event of handle.events()) void _event;
    })();

    const opened = records.find((entry) => entry.message === "terminal session opened");
    const pid = opened?.metadata?.pid as number;
    expect(typeof pid).toBe("number");
    expect(() => process.kill(pid, 0)).not.toThrow();

    await supervisor.dispose();

    expect(() => process.kill(pid, 0)).toThrow(/ESRCH/);
  });

  test("reports live terminal activity with a stable id and display label", async () => {
    const { logger, records } = createRecordingLogger();
    const supervisor = createTerminalSupervisor({ logger });
    const handle = supervisor.api.openSession({ command: ["/bin/sh"], cols: 80, rows: 24 });
    void (async () => {
      for await (const _event of handle.events()) void _event;
    })();

    expect(supervisor.activity()).toEqual([{ id: handle.id, label: "sh" }]);

    // Interactive shells may ignore SIGTERM while they own a PTY. This test
    // verifies activity cleanup, so use the unconditional cleanup signal.
    await handle.kill("SIGKILL");
    expect(supervisor.activity()).toEqual([]);
    expect(records).toContainEqual({
      message: "terminal session kill",
      metadata: { id: handle.id, signal: "SIGKILL" },
    });
  });
});

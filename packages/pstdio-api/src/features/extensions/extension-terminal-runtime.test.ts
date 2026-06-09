import { describe, expect, test } from "bun:test";
import type { ExtensionLoggerApi, TerminalEvent } from "@pstdio/sdk/extensions";
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
    const last = events.at(-1);
    expect(last?.kind).toBe("exit");
    expect(last).toMatchObject({ kind: "exit", code: 0 });

    // Lifecycle is logged, but PTY content never is.
    expect(records.some((entry) => entry.message === "terminal session opened")).toBe(true);
    expect(JSON.stringify(records)).not.toContain("hi-marker");
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
});

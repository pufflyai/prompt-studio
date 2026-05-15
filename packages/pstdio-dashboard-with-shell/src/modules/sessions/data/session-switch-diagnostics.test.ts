import { describe, expect, test } from "bun:test";
import {
  beginSessionSwitchTrace,
  createSessionSwitchDiagnosticEntry,
  recordSessionSwitchStep,
} from "./session-switch-diagnostics";

describe("createSessionSwitchDiagnosticEntry", () => {
  test("reports elapsed and duration timings for a session switch step", () => {
    expect(
      createSessionSwitchDiagnosticEntry({
        trace: {
          targetKey: "pstdio://sessions/session_2",
          startedAt: 12.25,
          source: "resource-open",
        },
        step: "conversation.hydrate.end",
        now: 44.789,
        durationMs: 18.111,
        metadata: { messageCount: 3 },
      }),
    ).toEqual({
      target: "pstdio://sessions/session_2",
      source: "resource-open",
      step: "conversation.hydrate.end",
      elapsedMs: 32.54,
      durationMs: 18.11,
      messageCount: 3,
    });
  });
});

describe("session switch diagnostics", () => {
  test("correlates session-only conversation steps with the resource-open trace", () => {
    const entries: unknown[] = [];
    const previousFlag = (globalThis as { __PSTDIO_SESSION_SWITCH_DIAGNOSTICS__?: boolean })
      .__PSTDIO_SESSION_SWITCH_DIAGNOSTICS__;
    const previousDebug = console.debug;

    (globalThis as { __PSTDIO_SESSION_SWITCH_DIAGNOSTICS__?: boolean }).__PSTDIO_SESSION_SWITCH_DIAGNOSTICS__ = true;
    console.debug = (_message?: unknown, entry?: unknown) => {
      entries.push(entry);
    };

    try {
      beginSessionSwitchTrace({
        resourceUri: "pstdio://projects/project_1/sessions/session_3",
        sessionId: "session_3",
        source: "resource.open",
      });
      recordSessionSwitchStep({ sessionId: "session_3", step: "conversation.hydrate.start" });

      expect(entries.at(1)).toMatchObject({
        target: "pstdio://projects/project_1/sessions/session_3",
        source: "resource.open",
        step: "conversation.hydrate.start",
      });
    } finally {
      if (previousFlag === undefined) {
        delete (globalThis as { __PSTDIO_SESSION_SWITCH_DIAGNOSTICS__?: boolean })
          .__PSTDIO_SESSION_SWITCH_DIAGNOSTICS__;
      } else {
        (globalThis as { __PSTDIO_SESSION_SWITCH_DIAGNOSTICS__?: boolean }).__PSTDIO_SESSION_SWITCH_DIAGNOSTICS__ =
          previousFlag;
      }
      console.debug = previousDebug;
    }
  });
});

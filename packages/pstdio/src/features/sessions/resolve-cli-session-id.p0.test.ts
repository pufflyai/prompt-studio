import { describe, expect, test } from "bun:test";
import { resolveCliSessionId } from "./resolve-cli-session-id";

describe("resolveCliSessionId", () => {
  test("prefers explicit session id over env", () => {
    const sessionId = resolveCliSessionId({
      explicitSessionId: "sess-explicit",
      env: { PSTDIO_SESSION_ID: "sess-env" } as NodeJS.ProcessEnv,
    });

    expect(sessionId).toBe("sess-explicit");
  });

  test("falls back to PSTDIO_SESSION_ID", () => {
    const sessionId = resolveCliSessionId({
      env: { PSTDIO_SESSION_ID: "sess-env" } as NodeJS.ProcessEnv,
    });

    expect(sessionId).toBe("sess-env");
  });

  test("returns undefined when neither explicit nor env is available", () => {
    const sessionId = resolveCliSessionId({
      env: {} as NodeJS.ProcessEnv,
    });

    expect(sessionId).toBeUndefined();
  });

  test("treats empty strings as missing", () => {
    const sessionId = resolveCliSessionId({
      explicitSessionId: "",
      env: { PSTDIO_SESSION_ID: "" } as NodeJS.ProcessEnv,
    });

    expect(sessionId).toBeUndefined();
  });
});

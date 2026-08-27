import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler } from "./check";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("connection check command", () => {
  test("checks the exact declared project connection", async () => {
    const checkConnection = mock(async () => ({ configured: true, lastCheck: { ok: true, status: 200 } }));
    console.log = mock(() => {}) as typeof console.log;
    const handler = createHandler({ checkConnection } as never);

    await handler({ project: "project-1", extension: "pstdio.remote", connection: "control-plane" } as never);

    expect(checkConnection).toHaveBeenCalledWith("project-1", "pstdio.remote", "control-plane");
  });
});

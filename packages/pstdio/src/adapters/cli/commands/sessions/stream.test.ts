import { describe, expect, type Mock, mock, test } from "bun:test";
import { createHandler } from "./stream";

type SSEEvent = { event: string; data: string };

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    connectSSE: mock(async (_url: string, _onEvent: (event: SSEEvent) => void) => {}),
    ...overrides,
    log,
  };
};

describe("sessions stream", () => {
  test("connects to SSE and prints streaming header", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler({ id: "s_abc123" } as any);

    expect(deps.log.mock.calls[0][0]).toContain("Streaming session s_abc123");
    expect(deps.connectSSE).toHaveBeenCalled();
  });

  test("renders patch text values", async () => {
    const deps = makeDeps({
      connectSSE: mock(async (_url: string, onEvent: (event: SSEEvent) => void) => {
        onEvent({ event: "ready", data: JSON.stringify({ sessionId: "s_1" }) });
        onEvent({
          event: "patch",
          data: JSON.stringify({ op: "add", path: "/messages/0/parts/0", value: { text: "Hello world" } }),
        });
        onEvent({ event: "end", data: JSON.stringify({ status: "completed" }) });
      }),
    });
    const handler = createHandler(deps);

    await handler({ id: "s_1" } as any);

    const outputs = deps.log.mock.calls.map((c) => c[0] as string);
    expect(outputs).toContain("Hello world");
    expect(outputs.some((o) => o.includes("completed"))).toBe(true);
  });

  test("renders approval request notification", async () => {
    const deps = makeDeps({
      connectSSE: mock(async (_url: string, onEvent: (event: SSEEvent) => void) => {
        onEvent({ event: "ready", data: JSON.stringify({ sessionId: "s_1" }) });
        onEvent({
          event: "approval_request",
          data: JSON.stringify({ id: "req_1", toolName: "Write", toolInput: {}, toolUseId: "tu_1" }),
        });
      }),
    });
    const handler = createHandler(deps);

    await handler({ id: "s_1" } as any);

    const outputs = deps.log.mock.calls.map((c) => c[0] as string);
    expect(outputs.some((o) => o.includes("Awaiting approval"))).toBe(true);
    expect(outputs.some((o) => o.includes("req_1"))).toBe(true);
  });
});

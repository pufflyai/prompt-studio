import { expect, test } from "bun:test";
import type { ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { readTestOutput } from "./deployed-machine-output";

test("test output consumes each page and preserves stored-wins and live-message order within its tail", async () => {
  let firstPageConsumed = false;
  const requested: string[] = [];
  const message = (id: string, output: string) => ({
    message_id: id,
    role: "assistant",
    occurred_at: "now",
    parts: [{ type: "tool", name: "shell", status: "completed", output_text: output }],
  });
  const first = message("first", "old ".repeat(20000));
  const parts = first.parts;
  Object.defineProperty(first, "parts", {
    get() {
      firstPageConsumed = true;
      return parts;
    },
  });
  const connections: Pick<ExtensionConnectionsApi, "request"> = {
    async request<T>(
      _connection: Parameters<ExtensionConnectionsApi["request"]>[0],
      request: Parameters<ExtensionConnectionsApi["request"]>[1],
    ) {
      requested.push(request.path);
      if (request.path.endsWith("/open"))
        return {
          status: 200,
          headers: {},
          body: {
            turns: [{ messages: [message("committed-empty", "stale live output"), message("live", "live final")] }],
          } as T,
        };
      const cursor = new URL(request.path, "https://controller.invalid").searchParams.get("cursor");
      if (!cursor) return { status: 200, headers: {}, body: { items: [first], next_cursor: "next" } as T };
      expect(firstPageConsumed).toBe(true);
      return {
        status: 200,
        headers: {},
        body: {
          items: [message("committed-empty", ""), message("stored-final", "\x1b[31mstored final\x1b[0m")],
          next_cursor: null,
        } as T,
      };
    },
  };
  const output = await readTestOutput(connections, "machine");
  expect(requested).toHaveLength(3);
  expect(output.startsWith("[Earlier output omitted]\n")).toBe(true);
  expect(output.length).toBeLessThanOrEqual(65536 + "[Earlier output omitted]\n".length);
  expect(output.endsWith("[now] shell (completed)\nstored final\n\n[now] shell (completed)\nlive final")).toBe(true);
  expect(output).not.toContain("stale live output");
  expect(output).not.toContain("\x1b");
});

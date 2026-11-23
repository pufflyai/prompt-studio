import { expect, test } from "bun:test";
import { stripVTControlCharacters } from "node:util";
import type { ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { readWorkspaceLogs } from "./deployed-machine-output";

test.each([
  { contents: ["first\n", "second\n"] },
  { contents: ["before\x1b[", "31mred\x1b[0", "mafter"] },
  { contents: ["before\x1b]8;;https://example.com", "\x1b", "\\link\x1b]8;;\x07after"] },
  { contents: ["x".repeat(70_000), "\x1b[31", "mend\x1b[0m"] },
])("workspace log tails preserve visible output across pages (%#)", async ({ contents }) => {
  let cursor = 0;
  const connections: Pick<ExtensionConnectionsApi, "request"> = {
    async request<T>(
      _connection: Parameters<ExtensionConnectionsApi["request"]>[0],
      request: Parameters<ExtensionConnectionsApi["request"]>[1],
    ) {
      const page = Number(new URL(request.path, "https://controller.invalid").searchParams.get("cursor") ?? 0);
      expect(page).toBe(cursor++);
      return {
        status: 200,
        headers: {},
        body: {
          items: [{ content: contents[page] }],
          next_cursor: page + 1 < contents.length ? String(page + 1) : null,
        } as T,
      };
    },
  };
  const plain = stripVTControlCharacters(contents.join(""));
  const expected = plain.length > 64 * 1024 ? `[Earlier output omitted]\n${plain.slice(-64 * 1024)}` : plain;
  expect(await readWorkspaceLogs(connections, "workspace")).toBe(expected);
  expect(cursor).toBe(contents.length);
});

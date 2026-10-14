import { describe, expect, test } from "bun:test";
import type { PageParams } from "pstdio-api-contracts/extension-kernel";
import { parsePageUrl, serializePageUrl } from "./page-url";

const page = {
  id: "board",
  ref: { kind: "page" as const, extensionId: "acme", id: "board" },
  path: "board",
  params: {
    range: { type: "string" as const, default: "now-1h" },
    refresh: { type: "number" as const, default: 30 },
    live: { type: "boolean" as const, default: false },
    "var-harness": { type: "string[]" as const, default: [] },
  },
};
const parse = (query: string) =>
  parsePageUrl({ url: `/projects/p1/extensions/acme/board?${query}`, projectId: "p1", pages: [page] });

describe("page URL params", () => {
  test("round trips typed params in declaration order and omits defaults", () => {
    const params = { live: true, range: "now-6h", refresh: 30, "var-harness": ["codex", "claude-code"] };
    const url = serializePageUrl({ projectId: "p1", page, params });
    expect(url).toBe(
      "/projects/p1/extensions/acme/board?range=now-6h&live=true&var-harness=codex&var-harness=claude-code",
    );
    expect(parsePageUrl({ url, projectId: "p1", pages: [page] })?.params).toEqual({
      range: "now-6h",
      live: true,
      "var-harness": ["codex", "claude-code"],
    });
  });
  test("drops unknown and malformed URL values without losing the page", () => {
    expect(parse("refresh=abc&live=1&foo=1&range=now-6h")?.params).toEqual({ range: "now-6h" });
    expect(parse("refresh=01&range=a&range=b")?.params).toBeUndefined();
  });
  test("rejects invalid programmatic params and oversized queries", () => {
    for (const params of [
      { foo: 1 },
      { refresh: "abc" },
      { refresh: Infinity },
      { range: "a".repeat(2050) },
    ] as PageParams[]) {
      expect(() => serializePageUrl({ projectId: "p1", page, params })).toThrow("page_param_invalid");
    }
  });
});

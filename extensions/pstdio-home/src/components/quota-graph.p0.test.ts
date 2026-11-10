import { expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuotaGraph } from "./quota-graph";

test("Home graphs an exhausted quota with an accessible value and leaves unknown quotas ungraphed", () => {
  const html = renderToStaticMarkup(
    createElement(ChakraProvider, {
      value: psTheme,
      // biome-ignore lint/correctness/noChildrenProp: ChakraProvider requires children in the props of this non-JSX render fixture.
      children: createElement(QuotaGraph, {
        loading: false,
        onRefresh: () => {},
        providers: [
          {
            id: "codex",
            label: "Codex",
            status: "available",
            checkedAt: "2026-11-10T12:00:00Z",
            limits: [{ id: "weekly", label: "Weekly", remainingPercent: 0 }],
          },
          {
            id: "pi",
            label: "Pi",
            status: "unsupported",
            checkedAt: "2026-11-10T12:00:00Z",
            limits: [],
            message: "Quota unavailable.",
          },
        ],
      }),
    }),
  );
  expect(html).toContain('aria-valuenow="0"');
  expect(html).toContain("Codex Weekly remaining quota");
  expect(html.match(/role="progressbar"/g)).toHaveLength(1);
  expect(html).toContain("Quota unavailable.");
});

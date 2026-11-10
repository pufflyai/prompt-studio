import { expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { quotaSelection } from "../quota-selection";
import type { QuotaReport } from "../quotas";
import { QuotaGraph } from "./quota-graph";

const provider = (id: string, remainingPercent: number): QuotaReport => ({
  id,
  label: id,
  status: "available",
  checkedAt: "2026-11-10T12:00:00Z",
  limits: [{ id: "weekly", label: "Weekly", remainingPercent }],
});

test("Home graphs an exhausted quota with an accessible value and leaves unknown quotas ungraphed", () => {
  const html = renderToStaticMarkup(
    createElement(ChakraProvider, {
      value: psTheme,
      // biome-ignore lint/correctness/noChildrenProp: ChakraProvider requires children in the props of this non-JSX render fixture.
      children: createElement(QuotaGraph, {
        loading: false,
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
  expect(html).toContain("100% used");
  expect(html).toContain("0% remaining");
  expect(html).toContain("Codex");
  expect(html).not.toContain("Quota unavailable.");
  expect(html).not.toContain(">Pi<");
  expect(html.includes('aria-label="Quota harness"')).toBe(false);
});

test("Home hides the quota widget when no provider has quota data", () => {
  const html = renderToStaticMarkup(
    createElement(ChakraProvider, {
      value: psTheme,
      // biome-ignore lint/correctness/noChildrenProp: Non-JSX render fixture.
      children: createElement(QuotaGraph, { providers: [], loading: false }),
    }),
  );
  expect(html.includes('aria-label="Agent quota usage"')).toBe(false);
});

test("multiple harnesses use a dropdown and display only the selected harness's chart", () => {
  const html = renderToStaticMarkup(
    createElement(ChakraProvider, {
      value: psTheme,
      // biome-ignore lint/correctness/noChildrenProp: Non-JSX render fixture.
      children: createElement(QuotaGraph, {
        providers: [provider("Codex", 10), provider("Claude", 75)],
        loading: false,
      }),
    }),
  );
  expect(html.includes('aria-label="Quota harness"')).toBe(true);
  expect(html).toContain("90% used");
  expect(html.includes("25% used")).toBe(false);
});

test("harness selection survives refreshed snapshots and recovers when the chosen quota disappears", () => {
  const reports = [provider("Codex", 10), provider("Claude", 75)];
  expect(quotaSelection(reports, "Claude").selected?.id).toBe("Claude");
  expect(
    quotaSelection([provider("Claude", 50), provider("Codex", 5)], "Claude").selected?.limits[0]?.remainingPercent,
  ).toBe(50);
  const withoutClaude = [reports[0]!, { ...reports[1]!, status: "unavailable" as const, limits: [] }];
  expect(quotaSelection(withoutClaude, "Claude").available).toHaveLength(1);
  expect(quotaSelection(withoutClaude, "Claude").selected?.id).toBe("Codex");
  expect(quotaSelection([], "Claude").selected).toBeUndefined();
});

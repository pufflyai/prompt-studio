import { expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { QuotaGraph } from "./quota-graph";

test("Home graphs an exhausted quota with an accessible value and leaves unknown quotas ungraphed", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <QuotaGraph
        loading={false}
        onRefresh={() => {}}
        providers={[
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
        ]}
      />
    </ChakraProvider>,
  );
  expect(html).toContain('aria-valuenow="0"');
  expect(html).toContain("Codex Weekly remaining quota");
  expect(html.match(/role="progressbar"/g)).toHaveLength(1);
  expect(html).toContain("Quota unavailable.");
});

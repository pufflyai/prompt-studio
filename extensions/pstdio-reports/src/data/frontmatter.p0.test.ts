import { describe, expect, test } from "bun:test";
import { buildReportFrontmatter, parseReportFrontmatter } from "./frontmatter";

describe("report frontmatter", () => {
  test("round-trips escaped scalar values", () => {
    const markdown = `${buildReportFrontmatter({
      reportName: "review",
      kind: 'review"final\\nphase',
      source: 'manual"source\\runner',
      createdAt: "2026-01-01T00:00:00.000Z",
      draft: true,
    })}\n\n# Body`;

    expect(parseReportFrontmatter(markdown)).toMatchObject({
      kind: 'review"final\\nphase',
      source: 'manual"source\\runner',
    });
  });
});

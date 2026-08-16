import { describe, expect, test } from "bun:test";
import { matchMarkdownSectionAnchors, resolveActiveMarkdownSection } from "./markdown-section-navigation";

describe("Markdown section navigation", () => {
  test("matches duplicate headings by occurrence and keeps stable section ids", () => {
    expect(
      matchMarkdownSectionAnchors(
        ["Intro", "Details", "Details", "Done"],
        [
          { id: "intro", heading: "Intro" },
          { id: "details-first", heading: "Details", occurrence: 0 },
          { id: "details-second", heading: "Details", occurrence: 1 },
        ],
      ),
    ).toEqual([
      { id: "intro", headingIndex: 0 },
      { id: "details-first", headingIndex: 1 },
      { id: "details-second", headingIndex: 2 },
    ]);
  });

  test("ignores missing headings instead of targeting another section", () => {
    expect(matchMarkdownSectionAnchors(["Intro", "Done"], [{ id: "missing", heading: "Details" }])).toEqual([]);
  });

  test("selects the last heading at or above the scroll threshold", () => {
    expect(
      resolveActiveMarkdownSection(
        [
          { id: "intro", top: -120 },
          { id: "details", top: -4 },
          { id: "done", top: 240 },
        ],
        8,
      ),
    ).toBe("details");
  });
});

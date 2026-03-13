import { describe, expect, test } from "bun:test";
import { extractDisplayTitle } from "./display-title";

describe("extractDisplayTitle", () => {
  test("extracts from simple heading", () => {
    expect(extractDisplayTitle("# Fix login bug\n\nSome body text")).toBe("fix-login-bug");
  });

  test("extracts from heading after frontmatter", () => {
    const content = `---
ticket_id: PS-1
status: backlog
---

# Add dark mode

Details here.`;
    expect(extractDisplayTitle(content)).toBe("add-dark-mode");
  });

  test("strips bold markdown", () => {
    expect(extractDisplayTitle("# Update **all** docs")).toBe("update-all-docs");
  });

  test("strips italic markdown", () => {
    expect(extractDisplayTitle("# Fix *critical* issue")).toBe("fix-critical-issue");
  });

  test("strips inline code", () => {
    expect(extractDisplayTitle("# Fix `getNow` function")).toBe("fix-getnow-function");
  });

  test("strips markdown links", () => {
    expect(extractDisplayTitle("# [Link](http://x.com) cleanup")).toBe("link-cleanup");
  });

  test("falls back to first non-empty line when no heading", () => {
    expect(extractDisplayTitle("Just some text\nMore text")).toBe("just-some-text");
  });

  test("falls back to first non-empty line after frontmatter", () => {
    const content = `---
status: backlog
---

No heading here, just text`;
    expect(extractDisplayTitle(content)).toBe("no-heading-here-just-text");
  });

  test("returns untitled for empty content", () => {
    expect(extractDisplayTitle("")).toBe("untitled");
  });

  test("truncates long titles to 50 characters", () => {
    const longTitle = "# " + "a".repeat(100);
    const result = extractDisplayTitle(longTitle);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  test("strips trailing hyphens after truncation", () => {
    const title = "# " + "word ".repeat(20);
    const result = extractDisplayTitle(title);
    expect(result).not.toMatch(/-$/);
  });

  test("handles special characters", () => {
    expect(extractDisplayTitle("# Hello   World!!! ")).toBe("hello-world");
  });

  test("skips level 2+ headings and uses first h1", () => {
    const content = `## Not this one

# This one

## Also not this`;
    expect(extractDisplayTitle(content)).toBe("this-one");
  });
});

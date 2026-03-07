import { describe, expect, it } from "bun:test";
import { parseChangelog } from "./changelog";

const sampleChangelog = `# Changelog

Stay up to date with the latest changes and improvements.

---

## v0.2.0

**Date:** Mar 10, 2026
**Tags:** new, improvement
**Title:** Dashboard Improvements
**Image:** https://example.com/hero.png

Major dashboard update with new features.

### Changes

- **New sidebar** — Redesigned navigation with collapsible sections.
- **Search** — Full-text search across docs. [Learn more](https://example.com/search)

---

## v0.1.0

**Date:** Mar 7, 2026
**Tags:** initial
**Title:** Initial Release

First release of prompt-studio.

### Changes

- **Project scaffolding** — Set up monorepo structure with Bun workspaces and Lerna.
`;

describe("parseChangelog", () => {
  it("parses header title and description", () => {
    const result = parseChangelog(sampleChangelog);
    expect(result.title).toBe("Changelog");
    expect(result.description).toBe("Stay up to date with the latest changes and improvements.");
  });

  it("parses all entries", () => {
    const result = parseChangelog(sampleChangelog);
    expect(result.entries).toHaveLength(2);
  });

  it("parses entry metadata", () => {
    const result = parseChangelog(sampleChangelog);
    const entry = result.entries[0];
    expect(entry.version).toBe("v0.2.0");
    expect(entry.date).toBe("Mar 10, 2026");
    expect(entry.title).toBe("Dashboard Improvements");
    expect(entry.tags).toEqual(["new", "improvement"]);
    expect(entry.image).toBe("https://example.com/hero.png");
    expect(entry.description).toBe("Major dashboard update with new features.");
  });

  it("parses changes with descriptions", () => {
    const result = parseChangelog(sampleChangelog);
    const changes = result.entries[0].changes!;
    expect(changes).toHaveLength(2);
    expect(changes[0].title).toBe("New sidebar");
    expect(changes[0].description).toBe("Redesigned navigation with collapsible sections");
  });

  it("parses changes with links", () => {
    const result = parseChangelog(sampleChangelog);
    const changes = result.entries[0].changes!;
    expect(changes[1].link).toBe("https://example.com/search");
    expect(changes[1].title).toBe("Search");
  });

  it("parses entry without image", () => {
    const result = parseChangelog(sampleChangelog);
    const entry = result.entries[1];
    expect(entry.image).toBeUndefined();
  });

  it("handles minimal changelog", () => {
    const minimal = `# Updates\n\n---\n\n## v1.0.0\n\n**Date:** Jan 1, 2026\n**Title:** Launch\n`;
    const result = parseChangelog(minimal);
    expect(result.title).toBe("Updates");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].version).toBe("v1.0.0");
    expect(result.entries[0].changes).toBeUndefined();
  });
});

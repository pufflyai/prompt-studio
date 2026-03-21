import { describe, expect, it } from "bun:test";
import { parseChangelogMarkdown } from "./docs-template-renderer";

describe("parseChangelogMarkdown", () => {
  it("parses header title and description", () => {
    const markdown = `# Changelog

Latest product updates.

---
## 1.0.0
**Date:** Mar 20, 2026
**Title:** First release

### Changes
- **Initial release** — The first version.
`;

    const result = parseChangelogMarkdown(markdown);
    expect(result.title).toBe("Changelog");
    expect(result.description).toBe("Latest product updates.");
  });

  it("parses a single entry with metadata and changes", () => {
    const markdown = `# Changelog

---
## 1.0.0
**Date:** Mar 20, 2026
**Title:** First release
**Tags:** new, launch

### Changes
- **Feature A** — Description of feature A.
- **Feature B** — Description of feature B.
`;

    const result = parseChangelogMarkdown(markdown);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].version).toBe("1.0.0");
    expect(result.entries[0].date).toBe("Mar 20, 2026");
    expect(result.entries[0].title).toBe("First release");
    expect(result.entries[0].tags).toEqual(["new", "launch"]);
    expect(result.entries[0].changes).toHaveLength(2);
    expect(result.entries[0].changes![0].title).toBe("Feature A");
    expect(result.entries[0].changes![0].description).toBe("Description of feature A");
  });

  it("parses multiple entries separated by ---", () => {
    const markdown = `# Changelog

---
## 2.0.0
**Date:** Mar 20, 2026
**Title:** Second release

### Changes
- **Upgrade** — Major upgrade.

---
## 1.0.0
**Date:** Mar 10, 2026
**Title:** First release

### Changes
- **Initial** — First version.
`;

    const result = parseChangelogMarkdown(markdown);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].version).toBe("2.0.0");
    expect(result.entries[1].version).toBe("1.0.0");
  });

  it("parses the actual project changelog format", () => {
    const markdown = `# Changelog

Latest product updates.

---

## 0.1.7

**Date:** Upcoming
**Title:** pstdio 0.1.7 (unreleased)
**Tags:** unreleased

### Changes

- **Ticket file editing** — Enable ticket details to select, edit, and autosave attached ticket files with URL-synced file selection.
- **Dashboard tab titles** — Improve dashboard tab titles for deep project and template settings views.

---

## 0.1.6

**Date:** Mar 17, 2026
**Title:** pstdio 0.1.6

### Changes

- **Empty template creation** — Allow creating project templates with empty content.
`;

    const result = parseChangelogMarkdown(markdown);
    expect(result.title).toBe("Changelog");
    expect(result.description).toBe("Latest product updates.");
    expect(result.entries).toHaveLength(2);

    expect(result.entries[0].version).toBe("0.1.7");
    expect(result.entries[0].date).toBe("Upcoming");
    expect(result.entries[0].title).toBe("pstdio 0.1.7 (unreleased)");
    expect(result.entries[0].tags).toEqual(["unreleased"]);
    expect(result.entries[0].changes).toHaveLength(2);

    expect(result.entries[1].version).toBe("0.1.6");
    expect(result.entries[1].date).toBe("Mar 17, 2026");
    expect(result.entries[1].changes).toHaveLength(1);
  });
});

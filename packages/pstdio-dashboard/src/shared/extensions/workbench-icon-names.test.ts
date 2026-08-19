import { describe, expect, test } from "bun:test";
import * as lucideIcons from "lucide-react";
import { workbenchIconNames } from "pstdio-extensions";

// The `extensions check` icon diagnostic validates against this generated list, and
// the workbench resolves icons against lucide-react. This test guards drift between
// the two when lucide-react is upgraded.
const toPascalCase = (value: string) =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

const uiGlyphNames = new Set([
  "status-backlog",
  "status-todo",
  "status-progress",
  "status-review",
  "status-done",
  "status-canceled",
  "level-low",
  "level-mid",
  "level-high",
  "level-xhigh",
]);

describe("workbench icon names", () => {
  test("every validated icon name resolves in lucide-react or the UI glyph set", () => {
    const unresolved = [...workbenchIconNames].filter((name) => {
      if (uiGlyphNames.has(name)) return false;
      const pascalName = toPascalCase(name);
      const icons = lucideIcons as Record<string, unknown>;
      return !icons[name] && !icons[pascalName] && !icons[`${pascalName}Icon`];
    });

    expect(unresolved).toEqual([]);
    expect(workbenchIconNames.size).toBeGreaterThan(1000);
  });
});

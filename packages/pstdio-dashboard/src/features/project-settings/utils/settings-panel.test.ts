import { describe, expect, test } from "bun:test";
import { ensureValidSettingsSection, parseSettingsPanel } from "./settings-panel";

describe("settings-panel", () => {
  test("parseSettingsPanel parses template panel ids", () => {
    expect(parseSettingsPanel("template:ticket")).toEqual({ template: "ticket" });
  });

  test("falls back to tags when active template no longer exists", () => {
    const section = ensureValidSettingsSection({ template: "deleted-template" }, [{ name: "ticket" }]);
    expect(section).toBe("tags");
  });

  test("keeps active template section when template still exists", () => {
    const activeSection = { template: "ticket" };
    const section = ensureValidSettingsSection(activeSection, [{ name: "ticket" }]);
    expect(section).toBe(activeSection);
  });
});

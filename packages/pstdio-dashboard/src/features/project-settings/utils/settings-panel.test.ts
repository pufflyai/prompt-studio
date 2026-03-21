import { describe, expect, test } from "bun:test";
import { ensureValidSettingsSection, parseSettingsPanel, toSettingsPanel } from "./settings-panel";

describe("settings-panel", () => {
  test("parseSettingsPanel parses template panel ids", () => {
    expect(parseSettingsPanel("template:ticket")).toEqual({ template: "ticket" });
  });

  test("parseSettingsPanel parses skill panel ids", () => {
    expect(parseSettingsPanel("skill:implement-ticket")).toEqual({ skill: "implement-ticket" });
  });

  test("toSettingsPanel serializes skill section", () => {
    expect(toSettingsPanel({ skill: "implement-ticket" })).toBe("skill:implement-ticket");
  });

  test("falls back to tags when active template no longer exists", () => {
    const section = ensureValidSettingsSection({ template: "deleted-template" }, [{ name: "ticket" }], undefined);
    expect(section).toBe("tags");
  });

  test("keeps active template section when template still exists", () => {
    const activeSection = { template: "ticket" };
    const section = ensureValidSettingsSection(activeSection, [{ name: "ticket" }], undefined);
    expect(section).toBe(activeSection);
  });

  test("falls back to tags when active skill no longer exists", () => {
    const section = ensureValidSettingsSection({ skill: "missing-skill" }, undefined, [{ name: "implement-ticket" }]);
    expect(section).toBe("tags");
  });

  test("keeps active skill section when skill still exists", () => {
    const activeSection = { skill: "implement-ticket" };
    const section = ensureValidSettingsSection(activeSection, undefined, [{ name: "implement-ticket" }]);
    expect(section).toBe(activeSection);
  });
});

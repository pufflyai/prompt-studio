import { describe, expect, test } from "bun:test";
import { ensureValidSettingsSection, parseSettingsPanel, toSettingsPanel } from "./settings-panel";

describe("settings-panel", () => {
  test("parseSettingsPanel parses template panel ids", () => {
    expect(parseSettingsPanel("template:ticket")).toEqual({ template: "ticket" });
  });

  test("parseSettingsPanel parses skill panel ids", () => {
    expect(parseSettingsPanel("skill:implement-ticket")).toEqual({ skill: "implement-ticket" });
  });

  test("parseSettingsPanel parses ticket statuses panel id", () => {
    expect(parseSettingsPanel("ticket-statuses")).toBe("ticket-statuses");
  });

  test("parseSettingsPanel parses tag panel ids", () => {
    expect(parseSettingsPanel("tag:abc-123")).toEqual({ tag: "abc-123" });
  });

  test("toSettingsPanel serializes skill section", () => {
    expect(toSettingsPanel({ skill: "implement-ticket" })).toBe("skill:implement-ticket");
  });

  test("toSettingsPanel serializes ticket statuses section", () => {
    expect(toSettingsPanel("ticket-statuses")).toBe("ticket-statuses");
  });

  test("toSettingsPanel serializes tag section", () => {
    expect(toSettingsPanel({ tag: "abc-123" })).toBe("tag:abc-123");
  });

  test("falls back to tags when active template no longer exists", () => {
    const section = ensureValidSettingsSection(
      { template: "deleted-template" },
      [{ name: "ticket" }],
      undefined,
      undefined,
    );
    expect(section).toBe("tags");
  });

  test("keeps active template section when template still exists", () => {
    const activeSection = { template: "ticket" };
    const section = ensureValidSettingsSection(activeSection, [{ name: "ticket" }], undefined, undefined);
    expect(section).toBe(activeSection);
  });

  test("falls back to tags when active skill no longer exists", () => {
    const section = ensureValidSettingsSection(
      { skill: "missing-skill" },
      undefined,
      [{ name: "implement-ticket" }],
      undefined,
    );
    expect(section).toBe("tags");
  });

  test("keeps active skill section when skill still exists", () => {
    const activeSection = { skill: "implement-ticket" };
    const section = ensureValidSettingsSection(activeSection, undefined, [{ name: "implement-ticket" }], undefined);
    expect(section).toBe(activeSection);
  });

  test("falls back to tags when active tag no longer exists", () => {
    const section = ensureValidSettingsSection({ tag: "missing-id" }, undefined, undefined, [{ id: "abc-123" }]);
    expect(section).toBe("tags");
  });

  test("keeps active tag section when tag still exists", () => {
    const activeSection = { tag: "abc-123" };
    const section = ensureValidSettingsSection(activeSection, undefined, undefined, [{ id: "abc-123" }]);
    expect(section).toBe(activeSection);
  });

  test("parseSettingsPanel parses repositories panel id", () => {
    expect(parseSettingsPanel("repositories")).toBe("repositories");
  });

  test("parseSettingsPanel parses extensions panel id", () => {
    expect(parseSettingsPanel("extensions")).toBe("extensions");
  });

  test("parseSettingsPanel does not treat legacy plugins as a settings panel", () => {
    expect(parseSettingsPanel("plugins")).toBe("tags");
  });

  test("toSettingsPanel serializes repositories section", () => {
    expect(toSettingsPanel("repositories")).toBe("repositories");
  });

  test("toSettingsPanel serializes extensions section", () => {
    expect(toSettingsPanel("extensions")).toBe("extensions");
  });

  test("ensureValidSettingsSection keeps repositories section", () => {
    expect(ensureValidSettingsSection("repositories", undefined, undefined, undefined)).toBe("repositories");
  });

  test("ensureValidSettingsSection keeps extensions section", () => {
    expect(ensureValidSettingsSection("extensions", undefined, undefined, undefined)).toBe("extensions");
  });
});

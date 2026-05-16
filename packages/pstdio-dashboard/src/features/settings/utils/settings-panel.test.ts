import { describe, expect, test } from "bun:test";
import { parseSettingsPanel, toSettingsPanel } from "./settings-panel";

describe("global settings panel", () => {
  test("defaults to runtime when panel is missing", () => {
    expect(parseSettingsPanel(undefined)).toBe("runtime");
  });

  test("parses supported panel ids", () => {
    expect(parseSettingsPanel("runtime")).toBe("runtime");
    expect(parseSettingsPanel("agents")).toBe("agents");
  });

  test("falls back to runtime for unsupported panel ids", () => {
    expect(parseSettingsPanel("unknown")).toBe("runtime");
  });

  test("serializes panel ids for routing", () => {
    expect(toSettingsPanel("runtime")).toBe("runtime");
    expect(toSettingsPanel("agents")).toBe("agents");
  });
});

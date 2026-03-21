import { describe, expect, test } from "bun:test";
import { parseSettingsPanel, toSettingsPanel } from "./settings-panel";

describe("global settings panel", () => {
  test("defaults to agents when panel is missing", () => {
    expect(parseSettingsPanel(undefined)).toBe("agents");
  });

  test("parses supported panel ids", () => {
    expect(parseSettingsPanel("agents")).toBe("agents");
  });

  test("falls back to agents for unsupported panel ids", () => {
    expect(parseSettingsPanel("unknown")).toBe("agents");
  });

  test("serializes panel ids for routing", () => {
    expect(toSettingsPanel("agents")).toBe("agents");
  });
});

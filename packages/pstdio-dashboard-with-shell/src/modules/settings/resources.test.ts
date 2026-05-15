import { describe, expect, it } from "bun:test";
import { createSettingsHref, isSettingsResource, parseSettingsLocation } from "./resources";

describe("settings resources", () => {
  it("parses pstdio:// and # settings locations into a settings resource", () => {
    expect(parseSettingsLocation("pstdio://settings")?.kind).toBe("settings");
    expect(parseSettingsLocation("#settings")?.kind).toBe("settings");
  });

  it("returns null for unrelated locations", () => {
    expect(parseSettingsLocation("pstdio://projects/abc/sessions")).toBeNull();
    expect(parseSettingsLocation("#settings/extras")).toBeNull();
  });

  it("creates a stable hash href for the settings route", () => {
    expect(createSettingsHref()).toBe("#settings");
  });

  it("identifies settings resources by kind", () => {
    expect(isSettingsResource({ kind: "settings", uri: "pstdio://settings" })).toBe(true);
    expect(isSettingsResource({ kind: "session", uri: "pstdio://projects/p/sessions/s" })).toBe(false);
  });
});

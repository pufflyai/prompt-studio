import { describe, expect, test } from "bun:test";
import {
  findExtensionCommandHint,
  formatMissingExtensionCommandMessage,
  hintedExtensionCommandNamespaces,
} from "./extension-command-hints";

describe("extension command hints", () => {
  test("maps familiar first-party CLI paths to canonical providers", () => {
    expect(findExtensionCommandHint("tickets pull")?.extensionId).toBe("pstdio.planner");
    expect(hintedExtensionCommandNamespaces.has("tickets")).toBe(true);
  });

  test("formats missing-provider recovery messaging", () => {
    const hint = findExtensionCommandHint("tickets pull");
    if (!hint) throw new Error("missing test hint");

    const message = formatMissingExtensionCommandMessage({ hint, disabled: true });

    expect(message).toContain('Command "tickets pull" is unavailable because no enabled extension provides it.');
    expect(message).toContain('It is normally provided by "pstdio.planner".');
    expect(message).toContain('Extension "pstdio.planner" is disabled for this project.');
    expect(message).toContain("pstdio extensions check");
  });
});

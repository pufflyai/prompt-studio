import { describe, expect, test } from "bun:test";
import { l10n } from "@pstdio/sdk/extensions";
import { text } from "./localization";

describe("text", () => {
  test("returns strings and localized defaults", () => {
    expect(text("Plain", "Fallback")).toBe("Plain");
    expect(text(l10n("extension.title", "Localized"), "Fallback")).toBe("Localized");
    expect(text({ $l10n: "extension.title" }, "Fallback")).toBe("extension.title");
    expect(text(undefined, "Fallback")).toBe("Fallback");
  });
});

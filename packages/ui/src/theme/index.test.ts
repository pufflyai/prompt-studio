import { describe, expect, test } from "bun:test";
import * as theme from "./index";

describe("theme exports", () => {
  test("does not export bundled custom theme preferences", () => {
    expect("customThemePreferences" in theme).toBe(false);
    expect("monokaiThemePreference" in theme).toBe(false);
  });
});

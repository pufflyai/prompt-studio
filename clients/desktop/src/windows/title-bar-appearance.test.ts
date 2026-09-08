import { describe, expect, test } from "bun:test";
import { titleBarOverlayOptions } from "./title-bar-appearance";

describe("native title bar appearance", () => {
  test("uses the rendered title bar height and colors for native controls", () => {
    expect(titleBarOverlayOptions({ height: 43, color: "rgb(249, 251, 250)", symbolColor: "rgb(20, 24, 22)" })).toEqual(
      {
        height: 43,
        color: "rgb(249, 251, 250)",
        symbolColor: "rgb(20, 24, 22)",
      },
    );
  });

  test("accepts dark and custom theme colors", () => {
    expect(
      titleBarOverlayOptions({ height: 43, color: "rgb(14, 16, 22)", symbolColor: "rgb(247, 248, 248)" }).color,
    ).toBe("rgb(14, 16, 22)");
  });

  test("rejects invalid appearance messages", () => {
    for (const value of [null, {}, { color: "red" }, { color: 12, symbolColor: "white" }]) {
      expect(() => titleBarOverlayOptions(value)).toThrow("Invalid title bar appearance");
    }
  });
});

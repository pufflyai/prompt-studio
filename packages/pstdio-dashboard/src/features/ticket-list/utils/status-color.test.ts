import { describe, expect, test } from "bun:test";
import { resolveTicketStatusColorPalette, resolveTicketStatusForeground } from "./status-color";

describe("status-color", () => {
  test("uses backend status colors as the palette source of truth", () => {
    expect(resolveTicketStatusColorPalette("yellow")).toBe("yellow");
    expect(resolveTicketStatusColorPalette("green")).toBe("green");
  });

  test("falls back to gray when status color is missing", () => {
    expect(resolveTicketStatusColorPalette(undefined)).toBe("gray");
  });

  test("derives semantic foreground tokens from the backend status color", () => {
    expect(resolveTicketStatusForeground("yellow")).toBe("yellow.fg");
    expect(resolveTicketStatusForeground("pink")).toBe("pink.fg");
  });

  test("falls back to gray foreground when status color is missing", () => {
    expect(resolveTicketStatusForeground(undefined)).toBe("gray.fg");
  });
});

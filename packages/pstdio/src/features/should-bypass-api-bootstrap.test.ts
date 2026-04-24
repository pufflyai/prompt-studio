import { describe, expect, test } from "bun:test";
import { shouldBypassApiBootstrap } from "./should-bypass-api-bootstrap";

describe("shouldBypassApiBootstrap", () => {
  test("returns true for commands that should not require the API", () => {
    expect(shouldBypassApiBootstrap("close")).toBe(true);
    expect(shouldBypassApiBootstrap("serve")).toBe(true);
    expect(shouldBypassApiBootstrap("extensions")).toBe(true);
  });

  test("returns false for commands that should bootstrap the API", () => {
    expect(shouldBypassApiBootstrap("tickets")).toBe(false);
    expect(shouldBypassApiBootstrap("projects")).toBe(false);
    expect(shouldBypassApiBootstrap(undefined)).toBe(false);
  });
});

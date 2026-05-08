import { describe, expect, test } from "bun:test";
import { validateUrl } from "./url";

describe("validateUrl", () => {
  test("rejects incomplete and malformed links", () => {
    expect(validateUrl("https://")).toBe(false);
    expect(validateUrl("not a link")).toBe(false);
    expect(validateUrl("mailto:")).toBe(false);
    expect(validateUrl("tel:")).toBe(false);
    expect(validateUrl("sms:")).toBe(false);
  });

  test("rejects unsupported protocols", () => {
    expect(validateUrl("javascript:alert(1)")).toBe(false);
    expect(validateUrl("ftp://example.com/file.txt")).toBe(false);
  });

  test("accepts supported absolute links", () => {
    expect(validateUrl("https://example.com/path")).toBe(true);
    expect(validateUrl("http://example.com")).toBe(true);
    expect(validateUrl("mailto:test@example.com")).toBe(true);
    expect(validateUrl("tel:+15555550123")).toBe(true);
  });
});

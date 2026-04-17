import { describe, expect, test } from "bun:test";
import { validateCronExpression } from "./cron";

describe("validateCronExpression", () => {
  test("accepts valid 5-field cron expressions", () => {
    expect(() => validateCronExpression("0 9 * * *", "plugin-a", "sync")).not.toThrow();
    expect(() => validateCronExpression("*/5 * * * *", "plugin-a", "sync")).not.toThrow();
    expect(() => validateCronExpression("0 0 1 1 0", "plugin-a", "sync")).not.toThrow();
    expect(() => validateCronExpression("0,30 9-17 * * 1-5", "plugin-a", "sync")).not.toThrow();
  });

  test("rejects 6-field quartz expressions", () => {
    expect(() => validateCronExpression("0 0 9 * * *", "plugin-a", "sync")).toThrow(
      /sync.*plugin-a.*must be a 5-field/,
    );
  });

  test("rejects expressions with fewer than 5 fields", () => {
    expect(() => validateCronExpression("0 9 * *", "plugin-a", "sync")).toThrow(/sync.*plugin-a.*must be a 5-field/);
  });

  test("rejects out-of-range minute", () => {
    expect(() => validateCronExpression("60 9 * * *", "plugin-a", "sync")).toThrow(/sync.*plugin-a/);
  });

  test("rejects out-of-range hour", () => {
    expect(() => validateCronExpression("0 24 * * *", "plugin-a", "sync")).toThrow(/sync.*plugin-a/);
  });

  test("rejects out-of-range day-of-month", () => {
    expect(() => validateCronExpression("0 0 32 * *", "plugin-a", "sync")).toThrow(/sync.*plugin-a/);
  });

  test("rejects out-of-range month", () => {
    expect(() => validateCronExpression("0 0 * 13 *", "plugin-a", "sync")).toThrow(/sync.*plugin-a/);
  });

  test("rejects out-of-range day-of-week", () => {
    expect(() => validateCronExpression("0 0 * * 8", "plugin-a", "sync")).toThrow(/sync.*plugin-a/);
  });

  test("rejects malformed tokens", () => {
    expect(() => validateCronExpression("0 abc * * *", "plugin-a", "sync")).toThrow(/sync.*plugin-a/);
  });

  test("includes cron expression in error message", () => {
    expect(() => validateCronExpression("bad", "plugin-a", "sync")).toThrow(/bad/);
  });

  test("includes plugin identity in error message", () => {
    expect(() => validateCronExpression("bad", "my-plugin", "nightly")).toThrow(/my-plugin/);
  });

  test("includes schedule name in error message", () => {
    expect(() => validateCronExpression("bad", "my-plugin", "nightly")).toThrow(/nightly/);
  });

  test("accepts step values", () => {
    expect(() => validateCronExpression("*/15 */2 * * *", "plugin-a", "sync")).not.toThrow();
  });

  test("accepts range values", () => {
    expect(() => validateCronExpression("0-30 9-17 * * *", "plugin-a", "sync")).not.toThrow();
  });

  test("accepts list values", () => {
    expect(() => validateCronExpression("0,15,30,45 * * * *", "plugin-a", "sync")).not.toThrow();
  });

  test("rejects empty string", () => {
    expect(() => validateCronExpression("", "plugin-a", "sync")).toThrow(/sync.*plugin-a/);
  });
});

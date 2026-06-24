import { describe, expect, test } from "bun:test";
import { parsePriorityFilter, parseStatusFilter } from "./dto";

describe("parseStatusFilter", () => {
  test("rejects invalid status tokens", () => {
    expect(() => parseStatusFilter("open,not-a-status")).toThrow("Invalid notification status: not-a-status");
  });

  test("rejects empty status tokens", () => {
    expect(() => parseStatusFilter("open,")).toThrow("Invalid notification status: <empty>");
  });

  test("rejects invalid priority tokens", () => {
    expect(() => parsePriorityFilter("high,not-a-priority")).toThrow("Invalid notification priority: not-a-priority");
  });
});

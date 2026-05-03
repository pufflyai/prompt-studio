import { describe, expect, test } from "bun:test";
import { getStaticCommandNames } from "./static-commands";

describe("getStaticCommandNames", () => {
  test("includes core static top-level segments", () => {
    const names = getStaticCommandNames();
    expect(names.has("tickets")).toBe(true);
    expect(names.has("projects")).toBe(true);
    expect(names.has("extensions")).toBe(true);
    expect(names.has("workspaces")).toBe(true);
  });

  test("does not include the dashboard ($0) entry", () => {
    const names = getStaticCommandNames();
    expect(names.has("$0")).toBe(false);
  });
});

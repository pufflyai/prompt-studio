import { describe, expect, it } from "bun:test";
import { matchesResourceWhen } from "./when";

describe("matchesResourceWhen", () => {
  it("is visible when no resourceType is declared", () => {
    expect(matchesResourceWhen(undefined, "ticket")).toBe(true);
    expect(matchesResourceWhen({}, undefined)).toBe(true);
    expect(matchesResourceWhen({ resourceType: [] }, "ticket")).toBe(true);
  });

  it("matches the active resource type", () => {
    expect(matchesResourceWhen({ resourceType: ["ticket"] }, "ticket")).toBe(true);
    expect(matchesResourceWhen({ resourceType: ["ticket", "session"] }, "session")).toBe(true);
  });

  it("hides when the active resource type differs or is absent", () => {
    expect(matchesResourceWhen({ resourceType: ["ticket"] }, "session")).toBe(false);
    expect(matchesResourceWhen({ resourceType: ["ticket"] }, undefined)).toBe(false);
  });
});

import { describe, expect, it } from "bun:test";
import { parseAction, parseRelatedRefs, parseResourceRef } from "./parse-resource";

describe("parseResourceRef", () => {
  it("splits on the first colon", () => {
    expect(parseResourceRef("ticket:PS-42")).toEqual({ type: "ticket", id: "PS-42" });
  });

  it("preserves additional colons in the id", () => {
    expect(parseResourceRef("session:abc:123")).toEqual({ type: "session", id: "abc:123" });
  });

  it("rejects values missing a colon", () => {
    expect(() => parseResourceRef("ticket")).toThrow();
  });
});

describe("parseRelatedRefs", () => {
  it("returns an empty list when value is missing", () => {
    expect(parseRelatedRefs(undefined)).toEqual([]);
  });

  it("accepts a single string", () => {
    expect(parseRelatedRefs("session:abc")).toEqual([{ type: "session", id: "abc" }]);
  });

  it("accepts an array", () => {
    expect(parseRelatedRefs(["ticket:PS-1", "session:s1"])).toEqual([
      { type: "ticket", id: "PS-1" },
      { type: "session", id: "s1" },
    ]);
  });
});

describe("parseAction", () => {
  it("parses an open-resource action", () => {
    const result = parseAction("Review proposal=open-resource:ticket:PS-42");
    expect(result).toMatchObject({
      label: "Review proposal",
      kind: "open-resource",
      resource: { type: "ticket", id: "PS-42" },
    });
  });

  it("rejects unsupported kinds", () => {
    expect(() => parseAction("Open=url:foo:bar")).toThrow();
  });
});

import { describe, expect, test } from "bun:test";
import { getCollection } from "./collections";

describe("dashboard sync collections", () => {
  test("exposes activity events for dashboard rendering", () => {
    const collection = getCollection("activity_events");

    expect(collection.id).toBe("activity_events");
  });
});

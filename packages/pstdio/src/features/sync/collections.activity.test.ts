import { describe, expect, test } from "bun:test";
import { getCollection } from "./collections";

describe("cli sync collections", () => {
  test("exposes activity events for synced dashboard state", () => {
    const collection = getCollection("activity_events");

    expect(collection.id).toBe("activity_events");
  });
});

import { describe, expect, test } from "bun:test";
import { getAllCollections, getCollection } from "./collections";

describe("cli sync collections", () => {
  test("exposes activity events for synced dashboard state", () => {
    const collection = getCollection("activity_events");

    expect(collection.id).toBe("activity_events");
  });

  test("does not preload legacy ticket tables", () => {
    const collections = getAllCollections();

    expect(collections.has("tickets")).toBe(false);
    expect(collections.has("ticket_statuses")).toBe(false);
    expect(collections.has("ticket_files")).toBe(false);
  });
});

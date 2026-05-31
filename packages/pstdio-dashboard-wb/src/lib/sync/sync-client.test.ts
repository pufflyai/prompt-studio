import { describe, expect, it } from "bun:test";
import { parseSyncDeleteEvent } from "./sync-client";

describe("parseSyncDeleteEvent", () => {
  it("reads the deleted id from sync:delete payloads emitted by the API", () => {
    const event = parseSyncDeleteEvent(
      JSON.stringify({
        table: "projects",
        data: { id: "project-1" },
        seq: 42,
      }),
    );

    expect(event).toEqual({
      table: "projects",
      id: "project-1",
      seq: 42,
    });
  });
});

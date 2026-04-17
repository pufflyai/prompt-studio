import { describe, expect, it } from "bun:test";
import { buildTicketContentRefreshKey } from "./use-ticket-content-refresh-key";

describe("buildTicketContentRefreshKey", () => {
  it("uses file updated timestamp when present", () => {
    const key = buildTicketContentRefreshKey({
      selectedFileId: "file-1",
      fileMetadataById: new Map([["file-1", { updated_at: "2026-04-17T10:00:00.000Z" }]]),
    });

    expect(key).toBe("file-1:2026-04-17T10:00:00.000Z");
  });

  it("falls back to selected file id when metadata is missing", () => {
    const key = buildTicketContentRefreshKey({
      selectedFileId: "file-1",
      fileMetadataById: new Map(),
    });

    expect(key).toBe("file-1");
  });
});

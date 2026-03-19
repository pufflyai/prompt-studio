import { describe, expect, test } from "bun:test";
import type { ApiTicketFilesResponse } from "@/features/ticket-list/data/api";
import {
  buildSelectableTicketFiles,
  resolveSelectedTicketFile,
  stripFileExtension,
  TICKET_CONTENT_FILE_NAME,
  TICKET_CONTENT_ITEM_ID,
} from "./ticket-file-selection";

const buildFilesResponse = (overrides: Partial<ApiTicketFilesResponse> = {}): ApiTicketFilesResponse => ({
  files: [],
  artifacts: [],
  ...overrides,
});

describe("stripFileExtension", () => {
  test("omits only the final extension", () => {
    expect(stripFileExtension("brief.v2.md")).toBe("brief.v2");
  });
});

describe("buildSelectableTicketFiles", () => {
  test("returns ticket-attached files and excludes ticket.md and workspace artifacts", () => {
    const result = buildSelectableTicketFiles(
      buildFilesResponse({
        files: [
          {
            id: "ticket-file",
            file_name: TICKET_CONTENT_FILE_NAME,
            file_kind: "ticket",
            mime_type: "text/markdown",
            size_bytes: 100,
            created_at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "brief-file",
            file_name: "brief.md",
            file_kind: "ticket-artifact",
            mime_type: "text/markdown",
            size_bytes: 200,
            created_at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "build-log",
            file_name: "build.log",
            file_kind: "artifact",
            mime_type: "text/plain",
            size_bytes: 200,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    expect(result).toEqual([
      {
        id: "brief-file",
        fileName: "brief.md",
        label: "brief",
      },
    ]);
  });
});

describe("resolveSelectedTicketFile", () => {
  test("defaults to ticket when no route file is selected", () => {
    const files = buildSelectableTicketFiles(
      buildFilesResponse({
        files: [
          {
            id: "brief-file",
            file_name: "brief.md",
            file_kind: "ticket-artifact",
            mime_type: "text/markdown",
            size_bytes: 200,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    expect(resolveSelectedTicketFile(files, undefined)).toEqual({
      id: TICKET_CONTENT_ITEM_ID,
      fileName: TICKET_CONTENT_FILE_NAME,
      label: "Ticket",
    });
  });

  test("returns the selected attachment when present", () => {
    const files = buildSelectableTicketFiles(
      buildFilesResponse({
        files: [
          {
            id: "brief-file",
            file_name: "brief.md",
            file_kind: "ticket-artifact",
            mime_type: "text/markdown",
            size_bytes: 200,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    expect(resolveSelectedTicketFile(files, "brief-file")).toEqual({
      id: "brief-file",
      fileName: "brief.md",
      label: "brief",
    });
  });
});

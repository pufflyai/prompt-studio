import { describe, expect, test } from "bun:test";
import type { SyncedRow } from "@/features/sync/collections";
import { buildTicketFileData } from "./use-ticket-files";

const row = (input: Record<string, unknown>): SyncedRow => input as SyncedRow;

describe("buildTicketFileData", () => {
  test("keeps artifacts linked by ticket_id even when no ticket_files link exists", () => {
    const ticketId = "ticket-1";
    const ticketFiles = [row({ id: "tf-1", ticket_id: ticketId, file_id: "file-1" })];
    const files = [
      row({
        id: "file-1",
        file_name: "ticket.md",
        file_kind: "ticket_file",
        mime_type: "text/markdown",
        size_bytes: 12,
        created_at: "2026-04-12T00:00:00.000Z",
      }),
      row({
        id: "artifact-file",
        file_name: "validation.log",
        file_kind: "artifact",
        mime_type: "text/plain",
        size_bytes: 30,
        created_at: "2026-04-12T00:00:00.000Z",
      }),
    ];
    const artifacts = [
      row({
        id: "artifact-1",
        ticket_id: ticketId,
        file_id: "artifact-file",
        file_name: "validation.log",
        file_kind: "artifact",
        relative_path: "artifacts/validation.log",
        mime_type: "text/plain",
        size_bytes: 30,
        created_at: "2026-04-12T00:00:00.000Z",
      }),
    ];

    const data = buildTicketFileData({ ticketId, ticketFiles, allFiles: files, allArtifacts: artifacts });

    expect(data.files).toHaveLength(1);
    expect(data.files[0]?.id).toBe("file-1");
    expect(data.artifacts).toHaveLength(1);
    expect(data.artifacts[0]?.id).toBe("artifact-1");
  });

  test("excludes artifacts from other tickets", () => {
    const ticketId = "ticket-1";
    const data = buildTicketFileData({
      ticketId,
      ticketFiles: [row({ id: "tf-1", ticket_id: ticketId, file_id: "file-1" })],
      allFiles: [
        row({
          id: "file-1",
          file_name: "ticket.md",
          file_kind: "ticket_file",
          mime_type: "text/markdown",
          size_bytes: 12,
          created_at: "2026-04-12T00:00:00.000Z",
        }),
      ],
      allArtifacts: [
        row({
          id: "artifact-foreign",
          ticket_id: "ticket-2",
          file_id: "artifact-file-2",
          file_name: "foreign.log",
          file_kind: "artifact",
          relative_path: "artifacts/foreign.log",
          mime_type: "text/plain",
          size_bytes: 18,
          created_at: "2026-04-12T00:00:00.000Z",
        }),
      ],
    });

    expect(data.artifacts).toEqual([]);
  });
});

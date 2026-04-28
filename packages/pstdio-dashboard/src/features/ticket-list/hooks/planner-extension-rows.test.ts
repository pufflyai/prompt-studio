import { describe, expect, test } from "bun:test";
import type { SyncedRow } from "@/features/sync/collections";
import {
  buildWorkspacesByPlannerTicket,
  plannerCollectionRows,
  toPlannerTicketFiles,
  toPlannerTicketRows,
} from "./planner-extension-rows";

describe("planner extension collection rows", () => {
  test("maps planner ticket collection items to ticket rows", () => {
    const items: SyncedRow[] = [
      {
        id: "row-1",
        project_id: "project-1",
        extension_id: "pstdio.planner",
        collection: "tickets",
        item_id: "PS-1",
        value_json: {
          id: "PS-1",
          projectId: "project-1",
          shorthand: "PS-1",
          displayTitle: "Planner ticket",
          statusId: "status-wip",
          tagNames: ["bug"],
          createdAt: "created",
          updatedAt: "updated",
        },
      },
    ];

    const rows = toPlannerTicketRows(plannerCollectionRows(items, "tickets", "project-1"));

    expect(rows[0]).toMatchObject({
      id: "PS-1",
      project_id: "project-1",
      shorthand: "PS-1",
      display_title: "Planner ticket",
      status_id: "status-wip",
      tag_names: ["bug"],
    });
  });

  test("links workspaces to planner tickets through anchors", () => {
    const workspacesByTicket = buildWorkspacesByPlannerTicket([
      {
        id: "ws-1",
        anchors_json: [{ type: "pstdio.planner.ticket", id: "ticket-1", label: "PS-1" }],
      },
    ]);

    expect(workspacesByTicket.get("ticket-1")?.[0]?.id).toBe("ws-1");
    expect(workspacesByTicket.get("PS-1")?.[0]?.id).toBe("ws-1");
  });

  test("maps planner stored files into previews and artifacts", () => {
    const result = toPlannerTicketFiles({
      id: "row-1",
      created_at: "created",
      updated_at: "updated",
      value_json: {
        files: [
          { id: "file-1", fileName: "note.txt", mimeType: "text/plain", contentBase64: "aGVsbG8=" },
          {
            id: "artifact-1",
            fileName: "report.md",
            mimeType: "text/markdown",
            contentBase64: "b2s=",
            relativePath: "reports/report.md",
          },
        ],
      },
    });

    expect(result.files[0]).toMatchObject({ id: "file-1", file_name: "note.txt", size_bytes: 5 });
    expect(result.artifacts[0]).toMatchObject({
      id: "artifact-1",
      file_id: "artifact-1",
      relative_path: "reports/report.md",
      size_bytes: 2,
    });
  });
});

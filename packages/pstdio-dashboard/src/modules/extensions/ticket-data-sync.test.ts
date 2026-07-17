import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { metadataWithTickets, response } from "./module-test-fixtures";
import { syncTicketData } from "./ticket-data-sync";

describe("syncTicketData", () => {
  test("hydrates ticket sync through the extension query command", async () => {
    const executeCommand = mock(async () => response as CommandExecuteResponse);

    await syncTicketData({ executeCommand, metadata: metadataWithTickets, projectId: "project-1" });

    expect(executeCommand).toHaveBeenCalledWith("project-1", "pstdio-core-tickets.query-tickets", {
      projectId: "project-1",
      source: "dashboard",
      metadata: { dataRendererId: "pstdio-core-tickets.tickets" },
    });
  });
});

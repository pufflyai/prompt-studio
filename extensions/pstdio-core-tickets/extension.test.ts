import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio core tickets extension contributions", () => {
  test("uses a native tree renderer for ticket files", () => {
    expect(extension.treeRenderers?.ticketFiles).toMatchObject({
      title: "Files",
      bodyCommand: { id: "pstdio-core-tickets.ticket-files.tree.body" },
      defaultExpandedSectionIds: ["files"],
    });
    expect(extension.views?.ticketFiles).toMatchObject({
      title: "Files",
      resourceKind: "ticket",
      target: "workbench.main.left",
      surface: "panel",
      treeRenderer: "ticketFiles",
    });
    expect(extension.views?.ticketFiles).not.toHaveProperty("webview");
  });
});

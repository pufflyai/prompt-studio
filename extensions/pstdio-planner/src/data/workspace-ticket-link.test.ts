import { describe, expect, test } from "bun:test";
import type { ExtensionWorkspace, ResourceAnchor } from "@pstdio/sdk/extensions";

const workspace = (anchors: ResourceAnchor[], shorthand = "T-9_A1") =>
  ({ id: "ws-1", workspace_shorthand: shorthand, anchors_json: anchors }) as unknown as ExtensionWorkspace;

// Anchors written before the top-level `shorthand` field existed carry the ticket
// shorthand in `metadata`, while `label` is the display title (`<shorthand> <title>`).
const legacyAnchor = (): ResourceAnchor =>
  ({
    type: "ticket",
    id: "ticket-1",
    label: "T-9 Fix the thing",
    metadata: { shorthand: "T-9" },
  }) as unknown as ResourceAnchor;

describe("workspace ticket link", () => {
  test("reads the ticket shorthand from a current anchor", async () => {
    const { isWorkspaceLinkedToTicket } = await import("./workspace-ticket-link");
    const anchor = { type: "ticket", id: "ticket-1", shorthand: "T-9", label: "T-9 Fix the thing" };

    expect(isWorkspaceLinkedToTicket(workspace([anchor as unknown as ResourceAnchor]), "T-9")).toBe(true);
  });

  test("reads the ticket shorthand from an anchor stored before the field moved", async () => {
    const { isWorkspaceLinkedToTicket, ticketShorthandFromWorkspace } = await import("./workspace-ticket-link");

    expect(ticketShorthandFromWorkspace(workspace([legacyAnchor()]))).toBe("T-9");
    expect(isWorkspaceLinkedToTicket(workspace([legacyAnchor()]), "T-9")).toBe(true);
  });

  test("falls back to the workspace shorthand convention when no ticket anchor exists", async () => {
    const { ticketShorthandFromWorkspace } = await import("./workspace-ticket-link");

    expect(ticketShorthandFromWorkspace(workspace([], "T-4_A2"))).toBe("T-4");
  });
});

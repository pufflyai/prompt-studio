import { expect, test } from "bun:test";
import type { ExtensionWorkspace, ResourceAnchor } from "@pstdio/sdk/extensions";

const workspace = (anchors: ResourceAnchor[], shorthand = "T-9_A1") =>
  ({ id: "ws-1", workspace_shorthand: shorthand, anchors_json: anchors }) as unknown as ExtensionWorkspace;

test("workspace links use ticket IDs even when the saved number is old", async () => {
  const { isWorkspaceLinkedToTicket } = await import("./workspace-ticket-link");
  const linked = workspace([{ type: "ticket", id: "ticket-1", shorthand: "T-9" }]);
  expect(isWorkspaceLinkedToTicket(linked, { id: "ticket-1" })).toBe(true);
  expect(isWorkspaceLinkedToTicket(linked, { id: "ticket-2" })).toBe(false);
});

test("session lifecycle events use the session ticket before workspace context", async () => {
  const { ticketRefFromLifecyclePayload } = await import("./workspace-ticket-link");
  const linkedWorkspace = workspace([{ type: "ticket", id: "workspace-ticket" }]);
  expect(
    ticketRefFromLifecyclePayload({
      anchors: [{ type: "ticket", id: "session-ticket" }],
      workspace: linkedWorkspace,
    }),
  ).toBe("session-ticket");
  expect(ticketRefFromLifecyclePayload({ anchors: [], workspace: linkedWorkspace })).toBe("workspace-ticket");
});

import { describe, expect, it } from "bun:test";
import { buildTicketExtensionResource, buildWorkspaceExtensionResource } from "./resource-context";

describe("extension resource context builders", () => {
  it("builds ticket resource metadata", () => {
    expect(
      buildTicketExtensionResource({
        projectId: "project-1",
        ticket: { id: "ticket-1", shorthand: "PS-1", title: "Fix menu actions" },
      }),
    ).toEqual({
      type: "ticket",
      id: "ticket-1",
      label: "PS-1",
      projectId: "project-1",
      metadata: { shorthand: "PS-1", title: "Fix menu actions" },
    });
  });

  it("builds workspace resource metadata", () => {
    expect(
      buildWorkspaceExtensionResource({
        projectId: "project-1",
        ticket: { id: "ticket-1", shorthand: "PS-1" },
        workspace: { id: "workspace-1", shorthand: "A1" },
      }),
    ).toEqual({
      type: "workspace",
      id: "workspace-1",
      label: "A1",
      projectId: "project-1",
      metadata: {
        ticket: "PS-1",
        ticketId: "ticket-1",
        workspaceShorthand: "A1",
      },
    });
  });
});

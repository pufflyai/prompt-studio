import { describe, expect, it } from "bun:test";
import {
  buildSessionWorkspaceHubModel,
  buildSessionWorkspaceHubPanelModel,
  getTicketShorthandFromWorkspaceShorthand,
} from "./workspace-hub";

describe("workspace hub helpers", () => {
  it("derives the ticket shorthand from a workspace shorthand", () => {
    expect(getTicketShorthandFromWorkspaceShorthand("PS-42_A3")).toBe("PS-42");
  });

  it("returns null when the workspace shorthand is invalid", () => {
    expect(getTicketShorthandFromWorkspaceShorthand("PS-42")).toBeNull();
    expect(getTicketShorthandFromWorkspaceShorthand("")).toBeNull();
    expect(getTicketShorthandFromWorkspaceShorthand(null)).toBeNull();
  });

  it("builds the workspace review route from the session workspace", () => {
    expect(
      buildSessionWorkspaceHubModel({
        projectId: "project-1",
        workspace: {
          id: "workspace-1",
          branch: "workspace/PS-42_A3",
          workspaceShorthand: "PS-42_A3",
        },
        diffSummary: {
          workspace_id: "workspace-1",
          file_count: 9,
          additions: 83,
          deletions: 9,
        },
      }),
    ).toEqual({
      href: "/projects/project-1/tickets/PS-42/workspaces/PS-42_A3",
      fileCount: 9,
      additions: 83,
      deletions: 9,
    });
  });

  it("returns null when the session is not attached to a routable workspace", () => {
    expect(
      buildSessionWorkspaceHubModel({
        projectId: "project-1",
        workspace: null,
        diffSummary: {
          workspace_id: "workspace-1",
          file_count: 9,
          additions: 83,
          deletions: 9,
        },
      }),
    ).toBeNull();

    expect(
      buildSessionWorkspaceHubModel({
        projectId: "project-1",
        workspace: {
          id: "workspace-1",
          branch: null,
          workspaceShorthand: "PS-42",
        },
        diffSummary: {
          workspace_id: "workspace-1",
          file_count: 9,
          additions: 83,
          deletions: 9,
        },
      }),
    ).toBeNull();
  });

  it("returns null when the workspace hub should not render after setup", () => {
    expect(
      buildSessionWorkspaceHubPanelModel({
        showWorkspaceHub: false,
        isWorkspaceInitializing: false,
        statusLabel: "Setting up workspace...",
        changesLabel: (count) => `${count} files changed`,
        projectId: "project-1",
        workspace: {
          id: "workspace-1",
          branch: "workspace/PS-42_A3",
          workspaceShorthand: "PS-42_A3",
        },
        diffSummary: {
          workspace_id: "workspace-1",
          file_count: 9,
          additions: 83,
          deletions: 9,
        },
      }),
    ).toBeNull();

    expect(
      buildSessionWorkspaceHubPanelModel({
        showWorkspaceHub: true,
        isWorkspaceInitializing: false,
        statusLabel: "Setting up workspace...",
        changesLabel: (count) => `${count} files changed`,
        projectId: "project-1",
        workspace: null,
        diffSummary: undefined,
      }),
    ).toBeNull();
  });

  it("returns a loading model while the workspace is initializing", () => {
    expect(
      buildSessionWorkspaceHubPanelModel({
        showWorkspaceHub: true,
        isWorkspaceInitializing: true,
        statusLabel: "Setting up workspace...",
        changesLabel: (count) => `${count} files changed`,
        projectId: "project-1",
        workspace: null,
        diffSummary: undefined,
      }),
    ).toEqual({
      status: "loading",
      statusLabel: "Setting up workspace...",
      changesLabel: "",
      additions: 0,
      deletions: 0,
    });
  });
});

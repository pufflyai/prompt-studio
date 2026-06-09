import { describe, expect, test } from "bun:test";
import { shouldShowSessionWorkspaceHub } from "@/modules/sessions/data/session-workspace-hub-visibility";

describe("shouldShowSessionWorkspaceHub", () => {
  test("shows the hub when the session has a workspace and the mode is not workspace detail", () => {
    expect(
      shouldShowSessionWorkspaceHub({ sessionId: "session-1", workspaceId: "ws-1", activeModeId: "sessions" }),
    ).toBe(true);
  });

  test("hides the hub when the session is not attached to a workspace", () => {
    expect(shouldShowSessionWorkspaceHub({ sessionId: "session-1", workspaceId: null, activeModeId: "sessions" })).toBe(
      false,
    );
  });

  test("hides the hub for a new session draft even when workspace context is present", () => {
    expect(shouldShowSessionWorkspaceHub({ sessionId: undefined, workspaceId: "ws-1", activeModeId: "sessions" })).toBe(
      false,
    );
  });

  test("hides the hub while the workbench is in workspace detail mode", () => {
    expect(
      shouldShowSessionWorkspaceHub({ sessionId: "session-1", workspaceId: "ws-1", activeModeId: "workspace" }),
    ).toBe(false);
  });

  test("hides the hub when both inputs are absent", () => {
    expect(shouldShowSessionWorkspaceHub({ sessionId: undefined, workspaceId: null, activeModeId: "workspace" })).toBe(
      false,
    );
  });

  test("shows the hub when there is no active mode but the session has a workspace", () => {
    expect(
      shouldShowSessionWorkspaceHub({ sessionId: "session-1", workspaceId: "ws-1", activeModeId: undefined }),
    ).toBe(true);
  });
});

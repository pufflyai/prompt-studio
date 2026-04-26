import { describe, expect, test } from "bun:test";
import { createExtensionCommandSessions } from "./extension-command-sessions";

describe("createExtensionCommandSessions", () => {
  test("creates an API session with prompt and primary workspace anchor", async () => {
    const calls: unknown[] = [];
    const sessions = createExtensionCommandSessions({
      projectId: "project-1",
      ensureApi: async () => {
        calls.push("ensure-api");
      },
      createSession: async (input) => {
        calls.push(input);
        return { id: "session-1" };
      },
    });

    const result = await sessions.create({
      title: "Review workspace",
      prompt: "Review this workspace.",
      anchors: [
        { type: "workspace", id: "workspace-context", projectId: "project-1", role: "context" },
        { type: "workspace", id: "workspace-primary", projectId: "project-1", role: "primary" },
      ],
    });

    expect(result).toEqual({ id: "session-1" });
    expect(calls).toEqual([
      "ensure-api",
      {
        project_id: "project-1",
        title: "Review workspace",
        prompt: "Review this workspace.",
        workspace_id: "workspace-primary",
      },
    ]);
  });

  test("rejects metadata because the sessions API cannot preserve it yet", async () => {
    const sessions = createExtensionCommandSessions({
      projectId: "project-1",
      ensureApi: async () => {},
      createSession: async () => ({ id: "session-1" }),
    });

    await expect(
      sessions.create({
        title: "Review workspace",
        prompt: "Review this workspace.",
        metadata: { source: "extension-command" },
      }),
    ).rejects.toThrow(/metadata/i);
  });

  test("rejects unsupported anchors instead of dropping them", async () => {
    const sessions = createExtensionCommandSessions({
      projectId: "project-1",
      ensureApi: async () => {},
      createSession: async () => ({ id: "session-1" }),
    });

    await expect(
      sessions.create({
        title: "Review ticket",
        prompt: "Review this ticket.",
        anchors: [{ type: "ticket", id: "ticket-1", projectId: "project-1", role: "primary" }],
      }),
    ).rejects.toThrow(/ticket/i);
  });
});

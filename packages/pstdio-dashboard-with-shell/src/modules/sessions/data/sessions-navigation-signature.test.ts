import { describe, expect, test } from "bun:test";
import type { Session } from "../types";
import { createSessionsNavigationSignature } from "./sessions-navigation-signature";

const session = (overrides: Partial<Session> = {}): Session => ({
  id: "session_1",
  projectId: "project_1",
  agentSessionId: "agent_session_1",
  title: "Implement shell",
  status: "in_progress",
  archived: false,
  agent: "codex",
  lastSelectedModel: "gpt-5",
  createdAt: "2026-05-15T10:00:00.000Z",
  updatedAt: "2026-05-15T10:30:00.000Z",
  ...overrides,
});

describe("createSessionsNavigationSignature", () => {
  test("ignores fields that are not rendered in the sessions navigation", () => {
    expect(createSessionsNavigationSignature([session()])).toBe(
      createSessionsNavigationSignature([session({ lastSelectedModel: "gpt-5.5" })]),
    );
  });

  test("changes when rendered navigation fields change", () => {
    expect(createSessionsNavigationSignature([session()])).not.toBe(
      createSessionsNavigationSignature([session({ status: "awaiting_input" })]),
    );
  });
});

import { expect, test } from "bun:test";
import type { CommandContext, NavigationTarget } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { commands } from "./commands";

test.each(["brief", "diagram"])("starts and opens a project creation session for %s", async (example) => {
  const started: Parameters<CommandContext["sessions"]["create"]>[0][] = [];
  const opened: NavigationTarget[] = [];
  const session = {
    type: "session" as const,
    id: "session-one",
    title: "Creation session",
    status: "in_progress" as const,
  };
  const result = await commands["start-creation"].run(
    ...makeCommandArgs({
      storage: createMemoryStorage(),
      params: { example },
      overrides: {
        workspaceId: "workspace-one",
        sessions: {
          create: async (input) => {
            started.push(input);
            return session;
          },
        },
        navigation: { open: (target) => opened.push(target) },
      },
    }),
  );
  expect(started).toHaveLength(1);
  expect(started[0].prompt!.length).toBeGreaterThan(0);
  expect(started[0]).toMatchObject({
    workspaceId: "workspace-one",
    prompt: expect.any(String),
    title: expect.any(String),
  });
  expect(started[0].harness).toBeUndefined();
  expect(opened).toEqual([
    expect.objectContaining({ kind: "panel", resource: expect.objectContaining({ type: "session", id: session.id }) }),
  ]);
  expect(result).toEqual({ sessionId: session.id });
});

test("a failed session creation does not open a missing session", async () => {
  const opened: NavigationTarget[] = [];
  await expect(
    commands["start-creation"].run(
      ...makeCommandArgs({
        storage: createMemoryStorage(),
        params: { example: "brief" },
        overrides: {
          sessions: {
            create: async () => {
              throw new Error("Agent unavailable");
            },
          },
          navigation: { open: (target) => opened.push(target) },
        },
      }),
    ),
  ).rejects.toThrow("Agent unavailable");
  expect(opened).toEqual([]);
});

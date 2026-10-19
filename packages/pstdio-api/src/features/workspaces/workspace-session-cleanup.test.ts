import { expect, test } from "bun:test";
import { finalizeWorkspaceDelete } from "./workspace-provider-lifecycle";

test("workspace deletion bounds session writes and removes the workspace after archival", async () => {
  let active = 0;
  let peak = 0;
  const archived: string[] = [];
  const sessions = Array.from({ length: 200 }, (_, index) => ({ id: `session-${index}`, archived: index === 0 }));
  let deleted = false;
  await finalizeWorkspaceDelete(
    {
      workspaceSessionService: { listByWorkspace: async () => sessions },
      sessionService: {
        archive: async (id: string) => {
          active++;
          peak = Math.max(peak, active);
          await Promise.resolve();
          archived.push(id);
          active--;
        },
      },
      workspaceService: {
        softDelete: async () => {
          expect(archived).toHaveLength(199);
          expect(active).toBe(0);
          deleted = true;
        },
      },
    } as never,
    { id: "workspace" } as never,
  );
  expect(peak).toBe(1);
  expect(archived).toEqual(sessions.slice(1).map((session) => session.id));
  expect(deleted).toBe(true);
});

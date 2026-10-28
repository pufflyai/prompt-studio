import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./delete";

const baseDeps = {
  cwd: () => "/repo",
  findProjectRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  deleteWorkspace: mock(async () => {}),
};

describe("workspaces delete", () => {
  test("deletes the selected workspace in the current project", async () => {
    const deleteWorkspace = mock(async () => {});

    const handler = createHandler({ ...baseDeps, deleteWorkspace });
    await handler({ id: "PS-1_A1", _: [], $0: "" } as never);

    expect(deleteWorkspace).toHaveBeenCalledWith({
      projectId: "proj-1",
      workspaceShorthand: "PS-1_A1",
    });
  });

  test("throws when no project config is found", async () => {
    const handler = createHandler({ ...baseDeps, findProjectRoot: () => null });
    await expect(handler({ id: "PS-1_A1", _: [], $0: "" } as never)).rejects.toThrow("Not inside a pstdio project.");
  });

  test("throws when not in pstdio project", async () => {
    const handler = createHandler({ ...baseDeps, readConfig: () => null });
    await expect(handler({ id: "PS-1_A1", _: [], $0: "" } as never)).rejects.toThrow(
      "Not inside a pstdio project. Run 'pstdio projects create' first.",
    );
  });
});

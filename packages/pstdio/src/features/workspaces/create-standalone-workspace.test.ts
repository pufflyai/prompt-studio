import { expect, test } from "bun:test";
import { createStandaloneWorkspace } from "./create-standalone-workspace";

test("reports failed provisioning as an error without printing creation success", async () => {
  const output: string[] = [];
  await expect(
    createStandaloneWorkspace(
      { projectId: "project" },
      {
        createWorkspace: async () =>
          ({
            workspace_shorthand: "PS_WS-1",
            provider_state: "failed",
            provider_error_json: { message: "Workspace directory is occupied: /workspaces/PS_WS-1" },
          }) as never,
        log: (line) => output.push(line),
      },
    ),
  ).rejects.toThrow("PS_WS-1 creation failed: Workspace directory is occupied");
  expect(output).toEqual([]);
});

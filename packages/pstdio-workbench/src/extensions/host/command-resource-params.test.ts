import { expect, test } from "bun:test";
import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import { createWorkbench } from "../../core";
import { executeWorkbenchExtensionCommand } from "./workbench-extension-command";

for (const explicit of [false, true]) {
  test(`direct resource commands submit their hidden identifier (explicit: ${explicit})`, async () => {
    const workbench = createWorkbench();
    const resource = { type: "artifact", id: "selected", extensionId: "artifacts", projectId: "project" };
    const requests: CommandExecuteRequest[] = [];
    const pending = executeWorkbenchExtensionCommand(
      {
        projectId: "project",
        workbench,
        metadata: {
          commands: [
            {
              id: "artifacts.command.delete",
              extensionId: "artifacts",
              title: "Delete artifact",
              params: { artifactId: { type: "text", required: true, resolvedFrom: "resource" } },
              resourceMutation: { kind: "remove", resourceType: "artifact", idParam: "artifactId" },
            },
          ],
        },
        executeCommand: (_id, body) => {
          requests.push(body);
          return { outcome: { status: "success", ok: true, value: {} } };
        },
      },
      "artifacts.command.delete",
      { resource, params: explicit ? { artifactId: "explicit" } : {} },
    );
    expect(requests).toEqual([]);
    workbench.commandPalette.store.getState().confirmation!.resolve(true);
    await pending;
    expect(requests).toHaveLength(1);
    expect(requests[0].params).toEqual({ artifactId: explicit ? "explicit" : "selected" });
    expect(requests[0].resource).toEqual(resource);
  });
}

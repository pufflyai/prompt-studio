import { expect, test } from "bun:test";
import type { ExtensionCommandRecord } from "@pstdio/sdk/api";
import { dispatchExtensionCliCommand, parseExtensionCommandArgs, renderCommandHelp } from "./extension-cli-router";

test("describes command-backed choices and accepts explicit values without resolving options", () => {
  const command: ExtensionCommandRecord = {
    id: "lab.run",
    extensionId: "pstdio.lab",
    title: "Run",
    cliPath: "lab run",
    params: {
      region: {
        type: "select",
        required: true,
        options: {
          command: { kind: "command", id: "regions", extensionId: "pstdio.lab" },
          valueField: "id",
          labelField: "name",
        },
      },
    },
  };
  expect(renderCommandHelp(command)).toContain("command-backed");
  expect(parseExtensionCommandArgs(command, ["--region", "eu"]).params).toEqual({ region: "eu" });
});

test("routes explicit empty text values through global CLI options", async () => {
  const calls: unknown[] = [];
  const command: ExtensionCommandRecord = {
    id: "lab.note.set",
    extensionId: "pstdio.lab",
    title: "Set note",
    cliPath: "lab note set",
    params: { note: { type: "text" }, label: { type: "text" } },
  };
  const code = await dispatchExtensionCliCommand({
    rawArgs: ["lab", "note", "set", "--note", "", "--label", "Keep", "--json", "--project-id", "project-1"],
    deps: {
      listCommands: async () => ({ commands: [command], diagnostics: [] }),
      resolveProjectId: (_cwd, projectId) => ({ projectId: projectId!, root: "/repo" }),
      execute: async (_id, request) => {
        calls.push(request);
        return {
          commandId: command.id,
          extensionId: command.extensionId,
          outcome: { ok: true, status: "success", value: undefined },
        };
      },
      log: () => {},
    },
  });
  expect(code).toBe(0);
  expect(calls).toEqual([
    { projectId: "project-1", workspaceId: undefined, params: { note: "", label: "Keep" }, source: "cli" },
  ]);
});

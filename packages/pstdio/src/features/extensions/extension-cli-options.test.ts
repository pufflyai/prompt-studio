import { expect, test } from "bun:test";
import type { ExtensionCommandRecord } from "@pstdio/sdk/api";
import { parseExtensionCommandArgs, renderCommandHelp } from "./extension-cli-router";

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

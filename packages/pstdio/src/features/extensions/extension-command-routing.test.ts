import { expect, test } from "bun:test";
import { topLevelCommandNames } from "../../adapters/cli/commands";
import { shouldDispatchExtensionCommand } from "./extension-command-routing";

test("core command namespaces do not enter extension routing", () => {
  const coreCommandNames = ["dashboard", ...topLevelCommandNames];
  const staticTopLevelCommands = new Set(coreCommandNames);

  for (const commandName of coreCommandNames) {
    expect(
      shouldDispatchExtensionCommand({
        rawArgs: [commandName, "--help"],
        staticTopLevelCommands,
        hasProjectConfig: () => {
          throw new Error("Core commands must not inspect the project config");
        },
      }),
    ).toBe(false);
  }
});

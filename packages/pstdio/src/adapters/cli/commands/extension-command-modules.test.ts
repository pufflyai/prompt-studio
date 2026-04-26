import { describe, expect, test } from "bun:test";
import type { RuntimeCliContribution } from "@pstdio/sdk/extensions";
import yargs, { type Argv, type CommandModule } from "yargs";
import { createExtensionCommandRegistry, formatUnavailableExtensionCommandMessage } from "./extension-command-modules";

const createContribution = (overrides: Partial<RuntimeCliContribution>): RuntimeCliContribution => ({
  path: "extension-lab inspect",
  pathSegments: ["extension-lab", "inspect"],
  commandId: "extension-lab.inspect",
  extensionId: "extension-lab",
  examples: ["pstdio extension-lab inspect"],
  ...overrides,
});

const createYargs = () =>
  yargs([])
    .scriptName("pstdio")
    .strict()
    .exitProcess(false)
    .fail((msg) => {
      throw new Error(msg);
    });

const applyBuilder = async (commandModule: CommandModule, cli: Argv) => {
  const { builder } = commandModule;
  if (!builder) return cli;
  if (typeof builder === "function") return await builder(cli);
  return cli.options(builder);
};

describe("createExtensionCommandRegistry", () => {
  test("builds namespace help metadata for extension commands", async () => {
    const registry = createExtensionCommandRegistry({
      cli: [
        createContribution({
          description: "Inspect extension runtime state",
          examples: ["pstdio extension-lab inspect", "pstdio extension-lab inspect --json"],
        }),
      ],
      staticTopLevelCommands: ["tickets", "workspaces"],
    });

    expect(registry.commandModules).toHaveLength(1);
    const namespaceModule = registry.commandModules[0];
    const built = await applyBuilder(namespaceModule, createYargs());
    const help = await built.getHelp();

    expect(help).toContain("inspect");
    expect(help).toContain("Inspect extension runtime state");
    expect(help).toContain("id: extension-lab.inspect");
    expect(help).toContain("extension: extension-lab");
    expect(help).toContain("example: pstdio extension-lab inspect --json");
  });

  test("supports parsing extension command paths and blocks execution", async () => {
    const registry = createExtensionCommandRegistry({
      cli: [createContribution({})],
      staticTopLevelCommands: [],
    });

    const cli = createYargs();
    for (const commandModule of registry.commandModules) {
      cli.command(commandModule as never);
    }

    await expect(async () => {
      await cli.parseAsync(["extension-lab", "inspect"]);
    }).toThrowError(/command execution is not enabled yet/);
  });

  test("marks duplicate extension paths as unavailable", () => {
    const registry = createExtensionCommandRegistry({
      cli: [
        createContribution({ extensionId: "extension-a", commandId: "extension-a.inspect" }),
        createContribution({ extensionId: "extension-b", commandId: "extension-b.inspect" }),
      ],
      staticTopLevelCommands: [],
    });

    const issue = registry.unavailableByPath.get("extension-lab inspect");
    expect(issue).toBeDefined();
    expect(issue?.reason).toBe("duplicate_extension_path");
    expect(issue?.extensionIds).toEqual(["extension-a", "extension-b"]);
    expect(registry.commandModules).toHaveLength(0);
  });

  test("marks static path collisions as unavailable", () => {
    const registry = createExtensionCommandRegistry({
      cli: [createContribution({ path: "tickets sync", pathSegments: ["tickets", "sync"] })],
      staticTopLevelCommands: ["tickets"],
    });

    const issue = registry.unavailableByPath.get("tickets sync");
    expect(issue).toBeDefined();
    expect(issue?.reason).toBe("static_command_collision");
    expect(registry.commandModules).toHaveLength(0);
  });

  test("marks duplicate static path collisions as static command collisions", () => {
    const registry = createExtensionCommandRegistry({
      cli: [
        createContribution({
          path: "extensions check",
          pathSegments: ["extensions", "check"],
          extensionId: "extension-a",
          commandId: "extension-a.check",
        }),
        createContribution({
          path: "extensions check",
          pathSegments: ["extensions", "check"],
          extensionId: "extension-b",
          commandId: "extension-b.check",
        }),
      ],
      staticTopLevelCommands: ["extensions"],
    });

    const issue = registry.unavailableByPath.get("extensions check");
    expect(issue).toBeDefined();
    expect(issue?.reason).toBe("static_command_collision");
    expect(issue?.extensionIds).toEqual(["extension-a", "extension-b"]);
    expect(registry.commandModules).toHaveLength(0);
  });

  test("marks single-segment extension paths as unavailable", () => {
    const registry = createExtensionCommandRegistry({
      cli: [
        createContribution({
          path: "extension-lab",
          pathSegments: ["extension-lab"],
          commandId: "extension-lab.root",
        }),
      ],
      staticTopLevelCommands: [],
    });

    const issue = registry.unavailableByPath.get("extension-lab");
    expect(issue).toBeDefined();
    expect(issue?.reason).toBe("unsupported_extension_path");
    expect(issue?.extensionIds).toEqual(["extension-lab"]);
    expect(issue?.commandIds).toEqual(["extension-lab.root"]);
    expect(registry.commandModules).toHaveLength(0);
  });
});

describe("formatUnavailableExtensionCommandMessage", () => {
  test("includes provider and command metadata", () => {
    const message = formatUnavailableExtensionCommandMessage({
      path: "extension-lab inspect",
      extensionIds: ["extension-lab"],
      commandIds: ["extension-lab.inspect"],
      reason: "static_command_collision",
    });

    expect(message).toContain('Extension command "extension-lab inspect" is unavailable');
    expect(message).toContain("Extensions: extension-lab");
    expect(message).toContain("Command ids: extension-lab.inspect");
    expect(message).toContain("pstdio extensions check");
  });
});

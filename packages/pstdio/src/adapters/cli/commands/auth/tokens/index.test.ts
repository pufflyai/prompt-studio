import { describe, expect, test } from "bun:test";
import type { Argv, CommandModule } from "yargs";
import { builder } from ".";

describe("auth tokens command", () => {
  test("registers every token operation", () => {
    const commands: string[] = [];
    const yargs = {
      command(module: CommandModule) {
        commands.push(String(module.command));
        return this;
      },
    } as unknown as Argv;

    builder(yargs);

    expect(commands).toEqual(["issue", "list", "revoke"]);
  });
});

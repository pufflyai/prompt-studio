import { describe, expect, test } from "bun:test";
import { subcommands } from ".";

describe("automation command", () => {
  test("registers every automation operation", () => {
    expect(subcommands.map((subcommand) => subcommand.command)).toEqual(["run", "status", "events", "cancel", "watch"]);
  });
});

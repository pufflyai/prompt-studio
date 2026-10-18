import { describe, expect, test } from "bun:test";
import { subcommands } from ".";

describe("auth tokens command", () => {
  test("registers every token operation", () => {
    expect(subcommands.map((subcommand) => subcommand.command)).toEqual(["issue", "list", "revoke"]);
  });
});

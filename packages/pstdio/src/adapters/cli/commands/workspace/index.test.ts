import { describe, expect, test } from "bun:test";
import { command } from "./index";

describe("workspaces command module", () => {
  test("uses plural top-level command name", () => {
    expect(command).toBe("workspaces [command]");
  });
});

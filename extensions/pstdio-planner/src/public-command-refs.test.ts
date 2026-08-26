import { describe, expect, test } from "bun:test";
import { plannerCommands } from "./commands";
import { planner } from "./public-command-refs";

describe("planner public command references", () => {
  test("refer only to commands exported by the planner", () => {
    const commandIds = new Set(plannerCommands.map((command) => command.ref.id));

    for (const ref of Object.values(planner)) {
      expect(ref.extensionId).toBe("pstdio.pstdio-planner");
      expect(commandIds.has(ref.id)).toBe(true);
    }
  });
});

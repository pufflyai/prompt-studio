import { describe, expect, test } from "bun:test";
import { buildInitialActionParamValues } from "./action-params-dialog";

describe("action params dialog", () => {
  test("seeds default param values before submit", () => {
    expect(
      buildInitialActionParamValues([
        {
          key: "mode",
          label: "Mode",
          type: "select",
          defaultValue: "worktree",
          options: [
            { label: "Worktree", value: "worktree" },
            { label: "Current branch", value: "current_branch" },
          ],
        },
        { key: "context", label: "Context", type: "longtext" },
      ]),
    ).toEqual({ mode: "worktree" });
  });
});
